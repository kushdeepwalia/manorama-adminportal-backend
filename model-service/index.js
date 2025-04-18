const express = require('express');
const app = express();
const PORT = process.env.PORT || 5002;

app.use(express.json());

app.use("/", (req, res) => {
  res.status(200).json({ messgage: `Service running on ${PORT}` })
})

app.listen(PORT, () => console.log(`Model Service running on ${PORT}`));
