"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const express = require('express');
const bodyParser = require('body-parser');
const serverless = require('serverless-http');
const auth_1 = __importDefault(require("./controllers/auth"));
const users_1 = __importDefault(require("./controllers/users"));
const activity_1 = __importDefault(require("./controllers/activity"));
const entries_1 = __importDefault(require("./controllers/entries"));
const challenges_1 = __importDefault(require("./controllers/challenges"));
const teams_1 = __importDefault(require("./controllers/teams"));
const images_1 = __importDefault(require("./controllers/images"));
const app = express();
app.use(bodyParser.json());
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
        return res.sendStatus(204);
    }
    const contentType = req.headers['content-type'] || '';
    if (!contentType.startsWith('multipart/form-data')) {
        if (req.body && Buffer.isBuffer(req.body)) {
            try {
                req.body = JSON.parse(req.body.toString('utf8'));
            }
            catch (e) {
                req.body = {};
            }
        }
        if (typeof req.body === 'string') {
            try {
                req.body = JSON.parse(req.body);
            }
            catch (e) {
                req.body = {};
            }
        }
    }
    next();
});
// Mount route controllers
app.use('/api', auth_1.default);
app.use('/api', users_1.default);
app.use('/api', activity_1.default);
app.use('/api', entries_1.default);
app.use('/api', challenges_1.default);
app.use('/api', teams_1.default);
app.use('/api', images_1.default);
// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', message: 'Server is running' });
});
// Lambda handler
const handler = (event, context) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c;
    if (event.rawPath) {
        event.rawPath = event.rawPath.replace(/^\/default/, '');
    }
    if ((_b = (_a = event.requestContext) === null || _a === void 0 ? void 0 : _a.http) === null || _b === void 0 ? void 0 : _b.path) {
        event.requestContext.http.path = event.requestContext.http.path.replace(/^\/default/, '');
    }
    if (event.body && event.isBase64Encoded) {
        const ct = (((_c = event.headers) === null || _c === void 0 ? void 0 : _c['content-type']) || '');
        if (ct.startsWith('multipart/form-data')) {
            event.body = Buffer.from(event.body, 'base64');
        }
        else {
            event.body = Buffer.from(event.body, 'base64').toString('utf8');
        }
        event.isBase64Encoded = false;
    }
    return serverlessHandler(event, context);
});
exports.handler = handler;
const serverlessHandler = serverless(app);
// Local development (ts-node / nodemon)
if (process.env.IS_OFFLINE || process.env.NODE_ENV === 'development') {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}
