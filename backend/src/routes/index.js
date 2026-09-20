const express = require('express');
const router = express.Router();

router.use('/dashboard', require('./dashboard'));
router.use('/warehouses', require('./warehouses'));
router.use('/zones', require('./zones'));
router.use('/bins', require('./bins'));
router.use('/products', require('./products'));
router.use('/inventory', require('./inventory'));
router.use('/sensors', require('./sensors'));
router.use('/alerts', require('./alerts'));
router.use('/orders', require('./orders'));
router.use('/employees', require('./employees'));
router.use('/equipment', require('./equipment'));
router.use('/snapshots', require('./snapshots'));

module.exports = router;
