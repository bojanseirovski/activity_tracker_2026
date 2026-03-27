const express = require('express');
const bodyParser = require('body-parser');
const serverless = require('serverless-http');
import authRoutes from './controllers/auth';
import usersRoutes from './controllers/users';
import activityRoutes from './controllers/activity';
import entriesRoutes from './controllers/entries';
import challengesRoutes from './controllers/challenges';
import teamsRoutes from './controllers/teams';
import imagesRoutes from './controllers/images';

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
            } catch (e) {
                req.body = {};
            }
        }
        if (typeof req.body === 'string') {
            try {
                req.body = JSON.parse(req.body);
            } catch (e) {
                req.body = {};
            }
        }
    }
    next();
});

// Mount route controllers
app.use('/api', authRoutes);
app.use('/api', usersRoutes);
app.use('/api', activityRoutes);
app.use('/api', entriesRoutes);
app.use('/api', challengesRoutes);
app.use('/api', teamsRoutes);
app.use('/api', imagesRoutes);

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', message: 'Server is running' });
});

// Lambda handler
export const handler = async (event: any, context: any) => {
    if (event.rawPath) {
        event.rawPath = event.rawPath.replace(/^\/default/, '');
    }
    if (event.requestContext?.http?.path) {
        event.requestContext.http.path = event.requestContext.http.path.replace(/^\/default/, '');
    }
    if (event.body && event.isBase64Encoded) {
        const ct = (event.headers?.['content-type'] || '');
        if (ct.startsWith('multipart/form-data')) {
            event.body = Buffer.from(event.body, 'base64');
        } else {
            event.body = Buffer.from(event.body, 'base64').toString('utf8');
        }
        event.isBase64Encoded = false;
    }
    return serverlessHandler(event, context);
};

const serverlessHandler = serverless(app);

// Local development (ts-node / nodemon)
if (process.env.IS_OFFLINE || process.env.NODE_ENV === 'development') {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}
