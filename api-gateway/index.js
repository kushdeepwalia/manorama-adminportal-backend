const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const app = express();

app.use('/auth',
  createProxyMiddleware({
    target: 'http://localhost:4000',
    changeOrigin: true
  })
);

app.use('/projects',
  createProxyMiddleware({
    target: 'http://localhost:4400',
    changeOrigin: true
  })
);

app.use('/models',
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
  res.status(200).json({ messgage: `Service running on ${PORT}` })
})

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`API Gateway running on ${PORT}`));
