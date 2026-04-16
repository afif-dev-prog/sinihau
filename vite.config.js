import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
import fs from 'fs'

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'log-plugin',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url === '/__log' && req.method === 'POST') {
            let body = '';
            req.on('data', chunk => body += chunk);
            req.on('end', () => {
              fs.writeFileSync('C:/Users/mew/Attendance System/sinihau/admin_data_dump.json', body);
              res.end('ok');
            });
            return;
          }
          next();
        });
      }
    }
  ],
})
