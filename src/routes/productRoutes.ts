import { Router } from 'express';
import productController from '../controllers/productController';
import { protect, restrictTo } from '../controllers/authController';
import reviewRouter from './reviewRoutes';

const productRouter = Router();

// router.param('id', productController.checkID);

// POST /product/234fad4/reviews
// GET /product/234fad4/reviews

productRouter.use('/:productId/reviews', reviewRouter);

productRouter
  .route('/top-5-cheap')
  .get(productController.aliasTopProducts, productController.getAllProducts);

productRouter.route('/product-stats').get(productController.getProductStats);
productRouter
  .route('/monthly-plan/:year')
  .get(
    protect,
    restrictTo('admin', 'lead-guide', 'guide'),
    productController.getMonthlyPlan
  );

productRouter
  .route('/products-within/:distance/center/:latlng/unit/:unit')
  .get(productController.getProductsWithin);
// /products-within?distance=233&center=-40,45&unit=mi
// /products-within/233/center/-40,45/unit/mi

productRouter
  .route('/distances/:latlng/unit/:unit')
  .get(productController.getDistances);

productRouter
  .route('/')
  .get(productController.getAllProducts)
  .post(
    protect,
    restrictTo('admin', 'lead-guide'),
    productController.createProduct
  );

productRouter
  .route('/:id')
  .get(productController.getProduct)
  .patch(
    protect,
    restrictTo('admin', 'lead-guide'),
    productController.uploadProductImages,
    productController.resizeProductImages,
    productController.updateProduct
  )
  .delete(
    protect,
    restrictTo('admin', 'lead-guide'),
    productController.deleteProduct
  );

export default productRouter;
