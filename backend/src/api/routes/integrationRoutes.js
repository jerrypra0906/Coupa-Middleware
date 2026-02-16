const express = require('express');
const router = express.Router();

// Placeholder routes - to be implemented
router.get('/', (req, res) => {
  res.json({ message: 'Get integrations - to be implemented' });
});

router.get('/:name', (req, res) => {
  res.json({ message: `Get integration ${req.params.name} - to be implemented` });
});

router.post('/:name/trigger', (req, res) => {
  res.json({ message: `Trigger integration ${req.params.name} - to be implemented` });
});

module.exports = router;

