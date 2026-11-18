import express from 'express';
import { getOrders, createOrder, updateOrder } from '../controllers/orderController.js';
import { verifyToken } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/', verifyToken, getOrders);
router.post('/', verifyToken, createOrder);
router.put('/:id', verifyToken, updateOrder);

export default router;