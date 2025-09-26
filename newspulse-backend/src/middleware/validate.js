// Zod validator helper
export const validate = (schema) => (req, res, next) => {
  const parsed = schema.safeParse({
    body: req.body,
    query: req.query,
    params: req.params,
  });
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      error: { message: 'Validation failed', details: parsed.error.issues }
    });
  }
  // Overwrite with parsed data (helps with types and trimming)
  req.body = parsed.data.body ?? req.body;
  req.query = parsed.data.query ?? req.query;
  req.params = parsed.data.params ?? req.params;
  next();
};
