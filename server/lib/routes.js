'use strict';

const CODES     = require('http-codes');
const data      = require('./data');

module.exports = function routesInit(app) {
    /**
     * GET /:id
     *
     * Gets the data for a stored playground, using version 0.
     *
     * 200: The stored playground data.
     * 404: No data found for the given id.
     * 500: Server error, some error happened when trying to load the playground.
     */
    app.get('/api/:id', (req, res, next) => {
        const { id } = req.params;
        const logState = { params: { id } };

        data.getPlayground(id, 0, (err, item, contents) => {
            if (err) {
                logState.err = err;
                req.log.error(logState, 'Failed to get playground.');
                res.json(CODES.INTERNAL_SERVER_ERROR, { msg: `There was an error trying to load playground ${id}@0` });
            }
            else if (!item) {
                const msg = `Unable to find playground with ID: ${id}`;

                req.log.info(logState, msg);
                res.json(CODES.NOT_FOUND, { msg });
            }
            else {
                req.log.debug(`Loaded playground using ID: ${id}`);
                res.json(CODES.OK, { item, contents });
            }

            next();
        });
    });

    /**
     * GET /:id/:version
     *
     * Gets the data for a stored playground, using the version specified.
     *
     * 200: The stored playground data.
     * 404: No data found for the given id/version.
     * 422: Invalid version specified.
     * 500: Server error, some error happened when trying to load the playground.
     */
    app.get('/api/:id/:version', (req, res, next) => {
        const { id, version } = req.params;
        const versionNum = parseInt(version, 10);

        const logState = { params: { id, version } };

        if (isNaN(versionNum)) {
            req.log.error(logState, 'Failed to get playground, version is NaN.');

            res.json(CODES.UNPROCESSABLE_ENTITY, { msg: `Invalid version, ${version} is not a number.` });

            next();

            return;
        }

        data.getPlayground(id, version, (err, item, contents) => {
            if (err) {
                logState.err = err;
                req.log.error(logState, 'Failed to get playground.');
                res.json(CODES.INTERNAL_SERVER_ERROR, {
                    msg: `There was an error trying to load playground ${id}@${version}`,
                });
            }
            else if (!item) {
                const msg = `No playground found with ID: ${id}, or no version ${version} exists.`;

                req.log.info(logState, msg);
                res.json(CODES.NOT_FOUND, { msg });
            }
            else {
                req.log.debug(`Loaded playground using ID: ${id}`);
                res.json(CODES.OK, { item, contents });
            }

            next();
        });
    });

    /**
     * POST /
     *
     * Creates a new playground.
     *
     * 201: New playground created, link can be found in Link header.
     * 422: New playground is invalid, there are validation errors with the sent data.
     * 500: Server error, some error happened when trying to save the playground.
     */
    app.post('/api', (req, res, next) => {
        const { name, author, isPublic, contents } = req.body;

        const logState = { params: { name, author, isPublic, contentsEmpty: !contents } };

        if (!name || !author || !contents) {
            req.log.error(logState, 'Failed to save playground, invalid params');

            res.json(CODES.UNPROCESSABLE_ENTITY, { msg: `Invalid params, either name, author, or contents is empty.` });

            next();

            return;
        }

        data.createPlayground(name, author, isPublic, false, false, contents, (err, item, contents) => {
            if (err) {
                logState.err = err;
                req.log.error(logState, 'Failed to update playground.');
                res.json(CODES.INTERNAL_SERVER_ERROR, { msg: 'There was an error trying to save the playground.' });
            }
            else {
                req.log.debug(`Created a new playground: ${item.id}`);
                res.json(CODES.OK, { item, contents });
            }

            next();
        });
    });

    /**
     * POST /:id
     *
     * Updates a playground with a new version.
     *
     * 201: New playground version created, link can be found in Link header.
     * 422: New playground version is invalid, there are validation errors with the sent data.
     * 500: Server error, some error happened when trying to save the playground version.
     */
    app.post('/api/:id', (req, res, next) => {
        const id = req.params.id;
        const { name, author, isPublic, contents } = req.body;

        const logState = { params: { id, name, author, isPublic, contentsEmpty: !contents } };

        if (!name || !author || !contents) {
            req.log.error(logState, 'Failed save playground, invalid params');

            res.json(CODES.UNPROCESSABLE_ENTITY, { msg: `Invalid params, either name, author, or contents is empty.` });

            next();

            return;
        }

        data.createPlaygroundVersion(id, name, author, isPublic, false, false, contents, (err, item, contents) => {
            if (err) {
                logState.err = err;
                req.log.error(logState, 'Failed to save playground.');
                res.json(CODES.INTERNAL_SERVER_ERROR, { msg: 'There was an error trying to save the playground.' });
            }
            else if (!item) {
                const msg = `No playground found with ID: ${id}.`;

                req.log.info(logState, msg);
                res.json(CODES.NOT_FOUND, { msg });
            }
            else {
                req.log.debug(`Created new playground version using ID: ${id}, added version ${item.version}`);
                res.json(CODES.OK, { item, contents });
            }

            next();
        });
    });
};
