const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const app = express();
const cors = require('cors');

app.use(cors({
  origin: '*', // or restrict to specific frontend origin
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use('/auth',
  createProxyMiddleware({
    target: 'http://localhost:4000',
    changeOrigin: true
  })
);

app.use('/project',
  createProxyMiddleware({
    target: 'http://localhost:4400',
    changeOrigin: true
  })
);

app.use('/model',
  createProxyMiddleware({
    target: 'http://localhost:4800',
    changeOrigin: true
  })
);

app.use('/org',
  createProxyMiddleware({
    target: 'http://localhost:5200',
    changeOrigin: true
  })
);

app.use('/admin',
  createProxyMiddleware({
    target: 'http://localhost:5600',
    changeOrigin: true
  })
);

app.use("/", (req, res) => {
  res.status(200).json({ message: `Service running on ${PORT}` })
})

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`API Gateway running on ${PORT}`));
