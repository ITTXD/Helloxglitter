const express = require('express');
const serverless = require('serverless-http');
const originalApp = require('../../server');

const app = express();

// Mount the original app at the function path so that req.path is correctly adjusted
// When request comes to /.netlify/functions/api/api/add
// The mount point /.netlify/functions/api consumes the prefix
// The remaining path /api/add is passed to originalApp
app.use('/.netlify/functions/api', originalApp);

module.exports.handler = serverless(app);
