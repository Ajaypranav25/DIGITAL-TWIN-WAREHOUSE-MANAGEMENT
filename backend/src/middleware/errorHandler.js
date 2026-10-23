// PostgreSQL SQLSTATE codes caused by bad client input rather than a server fault
const PG_CLIENT_ERRORS = {
  '23505': 409, // unique_violation       - e.g. product already placed in this bin
  '23503': 400, // foreign_key_violation  - e.g. reading for a sensor that does not exist
  '23514': 400, // check_violation        - e.g. negative quantity, stock > capacity
  '23502': 400, // not_null_violation
  '22P02': 400, // invalid_text_representation - e.g. /api/orders/abc
  'P0001': 400, // raise_exception        - business rules raised by our triggers/procedures
};

const errorHandler = (err, req, res, next) => {
  const pgStatus = PG_CLIENT_ERRORS[err.code];
  const statusCode = pgStatus || (res.statusCode === 200 ? 500 : res.statusCode);

  if (statusCode >= 500) {
    console.error(err.stack);
  }

  res.status(statusCode).json({
    error: true,
    message: err.message || 'Internal Server Error',
    detail: err.detail || null,
  });
};

module.exports = { errorHandler };
