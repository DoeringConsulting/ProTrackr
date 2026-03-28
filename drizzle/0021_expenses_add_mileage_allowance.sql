ALTER TABLE `expenses`
  MODIFY COLUMN `category` ENUM(
    'car',
    'train',
    'flight',
    'taxi',
    'transport',
    'mileage_allowance',
    'hotel',
    'fuel',
    'meal',
    'food',
    'other'
  ) NOT NULL;
