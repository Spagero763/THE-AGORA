/**
 * THE AGORA - Main Entry Point
 * Start the API server
 */

import 'dotenv/config';
import { startServer } from './api/server.js';

const port = parseInt(process.env.PORT || '3000');
startServer(port);
