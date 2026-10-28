// ─────────────────────────────────────────────────────────────
// Zod request validation middleware
//
// Usage:
//   router.post('/x', validateRequest({ body: schema }), handler)
//
// Parsed (and stripped/coerced) values are placed on:
//   req.validated.body / req.validated.query / req.validated.params
// and req.body is replaced with the parsed body.
// (req.query is read-only in Express 5, so it is not overwritten.)
// ─────────────────────────────────────────────────────────────

export const validateRequest = ({ body, query, params } = {}) => {
  return (req, _res, next) => {
    try {
      req.validated = req.validated || {};

      if (body) {
        req.validated.body = body.parse(req.body ?? {});
        req.body = req.validated.body;
      }

      if (query) {
        req.validated.query = query.parse(req.query ?? {});
      }

      if (params) {
        req.validated.params = params.parse(req.params ?? {});
      }

      next();
    } catch (err) {
      // ZodError is formatted by errorMiddleware
      next(err);
    }
  };
};

export default validateRequest;