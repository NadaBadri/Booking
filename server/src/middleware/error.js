// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  // eslint-disable-next-line no-console
  console.error(err);

  const status = err?.statusCode || 500;
  const message = err?.message || "Internal Server Error";
  return res.status(status).json({ message });
}

