# PixiJS Playground [![Build Status](https://travis-ci.org/englercj/playground.svg?branch=master)](https://travis-ci.org/englercj/playground)

The playground application is a server and client that allow you to create, view, save,
and share small PixiJS demos.

- Client code is in the [client folder][cf].
- Server code is in the [server folder][sf].

## Usage:

To run the application locally open two terminals, one to the [client folder][cf] and one to the [server folder][sf].

In each of them run `npm install` to install their individual dependencies. Then run `npm run dev` for each to start
locally. Finally, visit http://localhost:8080. Details can be found in the respective READMEs.

[cf]: client/
[sf]: server/

## To Do:

### Should Have (v1 or v2)

1. Add ability to use custom URL for pixi versions.
2. Load all scripts at once in results, then only execute in order.
3. Data attachments like images, or json to power a demo.
4. Embed view that embeds just the preview with a link back
    * Useful for blog/forums posts and such.
5. UI to star a playground
6. Add homepage and search results
    * Show highly starred/trending playgrounds on homepage
    * Also use official/features flags for homepage

### Nice to Have (v2+)

1. Infinite loop detection (https://github.com/CodePen/InfiniteLoopBuster)
2. Add some snippets for monaco, and enable command palette
3. Different default demos for different versions
4. More editor settings (tabs, theme, etc)
5. Add github auth integration for login
    * List your own playgrounds
    * Consistent author field
    * Import/Export from/to Gist functionality
6. Multi-file support, as well as custom html/css
7. Move logic/state out of views and use a pattern (reflux/redux, or something)
