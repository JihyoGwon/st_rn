import getWebpackServeMiddleware from '../apps/server/src/middleware/webpack-serve.js';

const middleware = getWebpackServeMiddleware();
await middleware.runWebpackCompiler({ forceDist: true });
