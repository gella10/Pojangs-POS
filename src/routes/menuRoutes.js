import express from 'express';
import {
  getMenu,
  createMenuItem,
  updateMenuItem,
  deleteMenuItem
} from '../controllers/menuController.js';
import { verifyToken } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/', verifyToken, getMenu);
router.post('/', verifyToken, createMenuItem);
router.put('/:id', verifyToken, updateMenuItem);
router.delete('/:id', verifyToken, deleteMenuItem);

export default router;