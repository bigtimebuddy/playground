// TODO: Optimistic locking failure retries!

import * as CODES from 'http-codes';
import * as restify from 'restify';
import * as bunyan from 'bunyan';
import { Tag } from '../models/Tag';
import { Playground } from '../models/Playground';
import { db } from '../lib/db';
import { ITag } from '../../../shared/types';
import { purgeCacheForUrls } from '../lib/cloudflare';

export function setupRoutes(app: restify.Server)
{
    /**
     * GET /playgrounds
     *
     * Searches for playgrounds that match the given query.
     *
     * 200: The stored playground data.
     * 404: No data found for the given query.
     * 422: Invalid query given for searching.
     * 500: Server error, some error happened when trying to load the playgrounds.
     */
    app.get('/api/playgrounds', (req, res, next) =>
    {
        const { q } = req.params;

        const logState: any = { params: { q } };

        if (!q)
        {
            const msg = `Failed to search playgrounds, query param is empty.`;

            req.log.error(logState, msg);
            res.json(CODES.UNPROCESSABLE_ENTITY, { msg });

            next();
            return;
        }

        Playground.search(q)
            .then((values) =>
            {
                if (!values || !values.length)
                {
                    const msg = `No playgrounds found during search.`;

                    req.log.info(logState, msg);
                    res.json(CODES.NOT_FOUND, { msg });
                }
                else
                {
                    req.log.info(`Loaded ${values.length} playgrounds by searching.`);
                    res.json(CODES.OK, values);
                }

                next();
            })
            .catch((err) =>
            {
                logState.err = err;
                req.log.error(logState, 'Failed to search playgrounds.');
                res.json(CODES.INTERNAL_SERVER_ERROR, {
                    msg: `There was an error trying to load playgrounds during search.`,
                });

                next();
            });
    });

    /**
     * GET /playground/:slug
     *
     * Gets the data for a stored playground.
     *
     * 200: The stored playground data.
     * 404: No data found for the given slug.
     * 500: Server error, some error happened when trying to load the playground.
     */
    app.get('/api/playground/:slug', (req, res, next) =>
    {
        const { slug } = req.params;
        const logState: any = { params: { slug } };

        Playground.findOne({ where: { slug }, include: [Tag] })
            .then((value) =>
            {
                if (!value)
                {
                    const msg = `No playground found with slug: ${slug}`;

                    req.log.info(logState, msg);
                    res.json(CODES.NOT_FOUND, { msg });
                }
                else
                {
                    req.log.info(`Loaded playground using slug: ${slug}`);
                    res.json(CODES.OK, value);
                }

                next();
            })
            .catch((err) =>
            {
                logState.err = err;
                req.log.error(logState, 'Failed to get playground.');
                res.json(CODES.INTERNAL_SERVER_ERROR, { msg: `There was an error trying to load playground ${slug}.` });

                next();
            });
    });

    /**
     * POST /playground
     *
     * Creates a new playground.
     *
     * 201: New playground created, link can be found in Link header.
     * 422: New playground is invalid, there are validation errors with the sent data.
     * 500: Server error, some error happened when trying to save the playground.
     */
    app.post('/api/playground', (req, res, next) =>
    {
        const { name, description, contents, author, pixiVersion, isPublic } = req.body;
        const params = { name, isPublic, pixiVersion, isContentsEmpty: !contents };

        const logState: any = { params };

        const tagsData: ITag[] = req.body.tags || [];
        const externalJs: string[] = req.body.externalJs || [];

        if (!contents || contents.length > 16777214)
        {
            req.log.error(logState, 'Failed to save playground, invalid params');

            res.json(CODES.UNPROCESSABLE_ENTITY, { msg: `Invalid params, 'contents' is empty.` });

            next();
            return;
        }

        db.transaction((t) =>
        {
            return Playground.create(
                { name, description, contents, author, pixiVersion, isPublic, externalJs },
                { transaction: t })
                .then((value) =>
                {
                    req.log.info(`Created a new playground: ${value.slug}`);

                    if (tagsData.length)
                    {
                        const tags = prepareTags(req.log, tagsData);
                        return value.$set('tags', tags, { transaction: t })
                            .then(() => Promise.resolve(value));
                    }

                    return Promise.resolve(value);
                })
                .then((value) =>
                {
                    res.json(CODES.CREATED, value);
                    next();
                })
                .catch((err) =>
                {
                    logState.err = err;
                    req.log.error(logState, 'Failed to create playground.');
                    res.json(CODES.INTERNAL_SERVER_ERROR, { msg: 'There was an error trying to save the playground.' });

                    next();
                });
        });
    });

    /**
     * PUT /playground/:slug
     *
     * Updates a playground with a new version.
     *
     * 201: New playground version created, link can be found in Link header.
     * 422: New playground version is invalid, there are validation errors with the sent data.
     * 500: Server error, some error happened when trying to save the playground version.
     */
    app.put('/api/playground/:slug', (req, res, next) =>
    {
        const { slug } = req.params;
        const { id, name, description, contents, author, pixiVersion, isPublic } = req.body;
        const params = { id, slug, name, isPublic, pixiVersion, isContentsEmpty: !contents };

        const logState: any = { params };

        const tagsData: ITag[] = req.body.tags || [];
        const externalJs: string[] = req.body.externalJs || [];

        if (!slug || !contents || slug.length !== 21 || contents.length > 16777214)
        {
            req.log.error(logState, 'Failed save playground, invalid params');

            res.json(CODES.UNPROCESSABLE_ENTITY, { msg: `Invalid params, either 'slug' or 'contents' is invalid.` });

            next();
            return;
        }

        db.transaction((t) =>
        {
            return Playground.findById(id, { transaction: t })
                .then((value) =>
                {
                    if (!value)
                    {
                        const msg = `No playground found with id: ${id}.`;

                        req.log.info(logState, msg);
                        res.json(CODES.NOT_FOUND, { msg });
                        next();
                        return;
                    }

                    return value.update(
                        { name, description, contents, author, pixiVersion, isPublic, externalJs, versionsCount: value.versionsCount + 1 },
                        { transaction: t })
                        .then((value) =>
                        {
                            if (value.slug !== slug)
                            {
                                const msg = `Playground found with id: ${id}, but has mismatched slug. Expected '${slug}', but got '${value.slug}'.`;

                                req.log.error(logState, msg);
                                res.json(CODES.INTERNAL_SERVER_ERROR, { msg });
                                next();
                            }
                            else
                            {
                                req.log.info(`Updated playground with slug: ${slug}, added version: ${value.versionsCount}`);

                                if (tagsData.length)
                                {
                                    const tags = prepareTags(req.log, tagsData);
                                    return value.$set('tags', tags, { transaction: t })
                                        .then(() => Promise.resolve(value));
                                }

                                return Promise.resolve(value);
                            }
                        })
                        .then((value) =>
                        {
                            purgeCacheForUrls(req.log, [
                                `https://pixiplayground.com/api/playground/${slug}`,
                                `https://www.pixiplayground.com/api/playground/${slug}`,
                                `http://pixiplayground.com/api/playground/${slug}`,
                                `http://www.pixiplayground.com/api/playground/${slug}`,
                            ]);
                            res.json(CODES.OK, value);
                            next();
                        })
                        .catch((err) =>
                        {
                            logState.err = err;
                            req.log.error(logState, 'Failed to save playground.');
                            res.json(CODES.INTERNAL_SERVER_ERROR, { msg: 'There was an error trying to save the playground.' });

                            next();
                        });
                });
        });
    });
};

function prepareTags(log: bunyan, tagsData: ITag[]): Tag[]
{
    const tags: Tag[] = [];

    for (let i = 0; i < tagsData.length; ++i)
    {
        if (tagsData[i] && typeof tagsData[i].id === 'number')
        {
            tags.push(new Tag({ id: tagsData[i].id }));
        }
        else
        {
            log.info(`Invalid tag listed in create, skipping. Tag: ${JSON.stringify(tagsData[i])}`);
        }
    }

    return tags;
}
