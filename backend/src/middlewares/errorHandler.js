
const errorHandler = (err, req, res, next) => {
  console.error('错误:', err.message);

  const statusCode = err.statusCode || 500;
  const message = err.message || '服务器内部错误';

  res.status(statusCode).json({
    success: false,
    error: message
  });
};

module.exports = errorHandler;