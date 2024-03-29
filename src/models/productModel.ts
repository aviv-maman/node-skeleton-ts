import { model, Schema } from 'mongoose';
import type { InferSchemaType } from 'mongoose';
import slugify from 'slugify';
// import { UserModel } from './userModel';
// import validator from 'validator';

const productSchema = new Schema(
  {
    name: {
      type: String,
      required: [true, 'A product must have a name'],
      unique: true,
      trim: true,
      maxlength: [
        40,
        'A product name must have less or equal then 40 characters',
      ],
      minlength: [
        3,
        'A product name must have more or equal then 3 characters',
      ],
      // validate: [validator.isAlpha, 'product name must only contain characters']
    },
    slug: String,
    type: {
      type: String,
      required: [true, 'A product must have a type'],
      enum: {
        values: ['franchise', 'game', 'dlc', 'company'],
        message: 'Type is either: franchise, game, dlc or company',
      },
    },
    ratingsAverage: {
      type: Number,
      default: 4.5,
      min: [1, 'Rating must be above 1.0'],
      max: [5, 'Rating must be below 5.0'],
      set: (val: number) => Math.round(val * 10) / 10, // 4.666666, 46.6666, 47, 4.7
    },
    ratingsQuantity: {
      type: Number,
      default: 0,
    },
    price: {
      type: Object,
      required: true,
      validate: [
        (value: { usd: number; eur: number; nis: number }) =>
          value.usd > 0 && value.eur > 0 && value.nis > 0,
        'A product must have a price',
      ],
    },
    priceDiscount: {
      type: Object,
      validate: {
        validator: function (val: { usd: number; eur: number; nis: number }) {
          // this only points to current doc on NEW document creation
          return 0 < val.usd && val.eur && val.nis <= 100;
        },
        message: 'Discount price ({VALUE}) should be below regular price',
      },
    },
    description: {
      type: String,
      trim: true,
    },
    imageCover: {
      type: String,
    },
    images: [String],
    createdAt: {
      type: Date,
      default: Date.now(),
      select: false,
    },
    secretProduct: {
      type: Boolean,
      default: false,
    },
    developer: {
      type: [String],
      // required: true,
      // validate: [
      //   (value) => value.length > 0,
      //   'A product must have a developer',
      // ],
    },
    publisher: {
      type: [String],
    },
    release_date: {
      type: Date,
    },
    guides: [
      {
        type: Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    __v: {
      type: Number,
      select: false,
    },
  },
  {
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
    timestamps: true, // add updatedAt
  }
);

// productSchema.index({ price: 1 });
productSchema.index({ price: 1, ratingsAverage: -1 });
productSchema.index({ slug: 1 });
productSchema.index({ startLocation: '2dsphere' });

// Virtual populate
productSchema.virtual('reviews', {
  ref: 'Review',
  foreignField: 'product',
  localField: '_id',
});

// DOCUMENT MIDDLEWARE: runs before .save() and .create() and NOT after .update()
productSchema.pre('save', function (next) {
  this.slug = slugify(this.name, { lower: true }); // this = document
  next();
});

// productSchema.pre('save', async function (next) { // Embedding guides
//   const guidesPromises = this.guides.map(async id => await UserModel.findById(id));
//   this.guides = await Promise.all(guidesPromises);
// next();
// });

// productSchema.pre('save', function(next) {
//   console.log('Will save document...');
//   next();
// });

// productSchema.post('save', function(doc, next) {
//   console.log(doc);
//   next();
// });

// QUERY MIDDLEWARE
// regex to match all methods that start with find => findById is findOne behind the scenes
// productSchema.pre('find', function (next) {
/////////////////////////////////////////////////////
// productSchema.pre(/^find/, function (next) {
//   this.find({ secretProduct: { $ne: true } }); // this = query object. we can chain all the methods of query

//   this.start = Date.now();
//   next();
// });

// productSchema.pre(/^find/, function (next) {
//   this.populate({
//     path: 'guides',
//     // select: '-__v -passwordChangedAt'
//   });

//   next();
// });
/////////////////////////////////////////////////////

// productSchema.post(/^find/, function (docs, next) {
//   console.log(`Query took ${Date.now() - this.start} milliseconds!`);
//   next();
// });

// AGGREGATION MIDDLEWARE {{URL}}/api/v1/products/product-stats
// productSchema.pre('aggregate', function (next) {
//   this.pipeline().unshift({ $match: { secretProduct: { $ne: true } } }); // this = aggregation object

//   console.log(this.pipeline());
//   next();
// });

export type Product = InferSchemaType<typeof productSchema>;
export const ProductModel = model('Product', productSchema);
