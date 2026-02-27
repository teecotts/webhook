import express from 'express';
import dotenv from 'dotenv';
import handler from '../../api/webhooks/instantly.js';
dotenv.config();
const app = express();
const port = process.env.PORT || 3000;
app.use(express.json());
// Helper to bridge Express req/res to Vercel handler if needed
// (In this case, the handler is already using express-like Request/Response types)
app.post('/api/webhooks/instantly', async (req, res) => {
    try {
        await handler(req, res);
    }
    catch (error) {
        console.error('Local Server Error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});
app.listen(port, () => {
    console.log(`🚀 Local Webhook Server running at http://localhost:${port}`);
    console.log(`Endpoint: http://localhost:${port}/api/webhooks/instantly`);
    console.log(`Press Ctrl+C to stop.`);
});
//# sourceMappingURL=local_server.js.map