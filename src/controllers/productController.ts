import multer from 'multer';
import type { FileFilterCallback } from 'multer';
import sharp from 'sharp';
import { ProductModel } from '../models/productModel';
import { catchAsync } from '../utils/catchAsync';
import handlerFactory from './handlerFactory';
import type { NextFunction, Request, Response } from 'express';
import AppError from '../utils/appError';

const multerStorage = multer.memoryStorage();

const multerFilter = (
  req: Request,
  file: Express.Multer.File,
  cb: FileFilterCallback
) => {
  if (file.mimetype.startsWith('image')) {
    cb(null, true);
  } else {
    return new AppError('Not an image! Please upload only images.', 400);
  }
};

const upload = multer({
  storage: multerStorage,
  fileFilter: multerFilter,
});

const uploadProductImages = upload.fields([
  { name: 'imageCover', maxCount: 1 },
  { name: 'images', maxCount: 3 },
]);

// upload.single('image') req.file
// upload.array('images', 5) req.files

const resizeProductImages = catchAsync(async (req, res, next) => {
  if (!req?.files?.imageCover || !req.files.images) return next();

  // 1) Cover image
  req.body.imageCover = `product-${req.params.id}-${Date.now()}-cover.jpeg`;
  await sharp(req.files.imageCover[0].buffer)
    .resize(2000, 1333)
    .toFormat('jpeg')
    .jpeg({ quality: 100 })
    .toFile(`../../public/img/products/${req.body.imageCover}`);

  // 2) Images
  req.body.images = [];

  await Promise.all(
    req.files.images.map(async (file, i) => {
      const filename = `product-${req.params.id}-${Date.now()}-${i + 1}.jpeg`;

      await sharp(file.buffer)
        .resize(2000, 1333)
        .toFormat('jpeg')
        .jpeg({ quality: 100 })
        .toFile(`../../public/img/products/${filename}`);

      req.body.images.push(filename);
    })
  );

  next();
});

const aliasTopProducts = (req: Request, res: Response, next: NextFunction) => {
  req.query.limit = '5';
  req.query.sort = '-ratingsAverage,price';
  req.query.fields = 'name,price,ratingsAverage,summary,difficulty';
  next();
};

const getAllProducts = handlerFactory.getAll(ProductModel);
const getProduct = handlerFactory.getOne(ProductModel, { path: 'reviews' }); // { path: 'reviews', select: '__v' });
const createProduct = handlerFactory.createOne(ProductModel);
const updateProduct = handlerFactory.updateOne(ProductModel);
const deleteProduct = handlerFactory.deleteOne(ProductModel);

const getProductStats = catchAsync(async (req, res, next) => {
  const stats = await ProductModel.aggregate([
    {
      $match: { ratingsAverage: { $gte: 4.5 } },
    },
    {
      $group: {
        _id: { $toUpper: '$difficulty' }, // _id: null => all documents | without toUpper: _id: '$difficulty' (no object)
        numProducts: { $sum: 1 }, // Sum each 1 document to get total
        numRatings: { $sum: '$ratingsQuantity' },
        avgRating: { $avg: '$ratingsAverage' },
        avgPrice: { $avg: '$price' },
        minPrice: { $min: '$price' },
        maxPrice: { $max: '$price' },
      },
    },
    {
      $sort: { avgPrice: 1 },
    },
    // {
    //   $match: { _id: { $ne: 'EASY' } } // id here is the difficulty, as we specified above in $group
    // }
  ]);

  res.status(200).json({
    status: 'success',
    data: {
      stats,
    },
  });
});

const getMonthlyPlan = catchAsync(async (req, res, next) => {
  const year = Number(req.params.year) * 1; // 2021

  const plan = await ProductModel.aggregate([
    {
      $unwind: '$startDates', // make an array from startDates with all fields of the document and output each element of the array
    }, // for example: 3 startDates in one document => 3 documents with each start date
    {
      $match: {
        startDates: {
          $gte: new Date(`${year}-01-01`),
          $lte: new Date(`${year}-12-31`),
        },
      },
    },
    {
      $group: {
        _id: { $month: '$startDates' },
        numProductStarts: { $sum: 1 },
        products: { $push: '$name' },
      },
    },
    {
      $addFields: { month: '$_id' },
    },
    {
      $project: {
        _id: 0,
      },
    },
    {
      $sort: { numProductStarts: -1 },
    },
    {
      $limit: 12,
    },
  ]);

  res.status(200).json({
    status: 'success',
    data: {
      plan,
    },
  });
});

// /products-within/:distance/center/:latlng/unit/:unit
// /products-within/233/center/34.111745,-118.113491/unit/mi
const getProductsWithin = catchAsync(async (req, res, next) => {
  const { distance, latlng, unit } = req.params;
  const [lat, lng] = latlng.split(',');

  const radius =
    unit === 'mi' ? Number(distance) / 3963.2 : Number(distance) / 6378.1;

  if (!lat || !lng) {
    next(
      new AppError(
        'Please provide latitutr and longitude in the format lat,lng.',
        400
      )
    );
  }

  const products = await ProductModel.find({
    startLocation: { $geoWithin: { $centerSphere: [[lng, lat], radius] } },
  });

  res.status(200).json({
    status: 'success',
    results: products.length,
    data: {
      data: products,
    },
  });
});

const getDistances = catchAsync(async (req, res, next) => {
  const { latlng, unit } = req.params;
  const [lat, lng] = latlng.split(',');

  const multiplier = unit === 'mi' ? 0.000621371 : 0.001; //localhost:8000/api/v1/products/distances/34.111745,-118.113491/unit/km

  if (!lat || !lng) {
    next(
      new AppError(
        'Please provide latitutr and longitude in the format lat,lng.',
        400
      )
    );
  }

  const distances = await ProductModel.aggregate([
    {
      $geoNear: {
        near: {
          type: 'Point',
          coordinates: [Number(lng), Number(lat)],
        },
        distanceField: 'distance',
        distanceMultiplier: multiplier,
      },
    },
    {
      $project: {
        distance: 1,
        name: 1,
      },
    },
  ]);

  res.status(200).json({
    status: 'success',
    data: {
      data: distances,
    },
  });
});

const productController = {
  uploadProductImages,
  resizeProductImages,
  aliasTopProducts,
  getAllProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
  getProductStats,
  getMonthlyPlan,
  getProductsWithin,
  getDistances,
};

export default productController;
