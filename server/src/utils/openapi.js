/**
 * Builds an OpenAPI 3 document by walking the registered Express routers,
 * so the documentation can never drift from the actual routes.
 */
export function buildOpenApi(modules, { version = '1.0.0' } = {}) {
  const paths = {};
  const PUBLIC = new Set(['/auth/login', '/auth/refresh', '/auth/logout', '/system/health']);
  for (const [base, router, tag] of modules) {
    for (const layer of router.stack) {
      if (!layer.route) continue;
      const route = `${base}${layer.route.path === '/' ? '' : layer.route.path}`.replace(/:(\w+)/g, '{$1}');
      const params = [...route.matchAll(/\{(\w+)\}/g)].map((m) => ({ name: m[1], in: 'path', required: true, schema: { type: 'string' } }));
      for (const method of Object.keys(layer.route.methods)) {
        paths[route] ||= {};
        const isUpload = layer.route.stack.some((s) => s.name === 'multerMiddleware');
        paths[route][method] = {
          tags: [tag],
          summary: `${method.toUpperCase()} ${route}`,
          parameters: params,
          ...(PUBLIC.has(`${base}${layer.route.path}`) ? { security: [] } : {}),
          ...(['post', 'put', 'patch'].includes(method)
            ? { requestBody: { content: isUpload ? { 'multipart/form-data': { schema: { type: 'object' } } } : { 'application/json': { schema: { type: 'object' } } } } }
            : {}),
          responses: {
            200: { description: 'Success — `{ success: true, data, meta? }`' },
            401: { description: 'Not authenticated' },
            403: { description: 'Missing permission or other department' },
            422: { description: 'Validation failed — `details[]` lists field errors' },
          },
        };
      }
    }
  }
  return {
    openapi: '3.0.3',
    info: {
      title: 'DWMT API',
      version,
      description:
        'Departmental Work Management & Task Tracking System REST API.\n\nAuthenticate with `POST /auth/login`, then send `Authorization: Bearer <accessToken>`. The refresh token is an HTTP-only cookie rotated by `POST /auth/refresh`.\n\nRequest bodies are validated with Zod; see `server/src/validators` and the route files for exact schemas.',
    },
    servers: [{ url: '/api/v1' }],
    components: { securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } } },
    security: [{ bearerAuth: [] }],
    paths,
  };
}
