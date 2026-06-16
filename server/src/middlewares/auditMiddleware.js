

import { auditLogger } from "../utils/auditLogger.js";

/**
 * auditLog — route-level middleware factory
 *
 * @param {object} config
 * @param {string|function} config.action      — AUDIT_ACTIONS value, or fn(req, resBody)=>string
 * @param {string|function} [config.targetId]  — ObjectId string, or fn(req, resBody)=>string
 * @param {string}          [config.targetType]— "user"|"post"|"report"
 * @param {object|function} [config.targetMeta]— plain object, or fn(req, resBody)=>object
 * @param {string|function} [config.note]      — extra note, or fn(req, resBody)=>string
 */
export function auditLog(config) {
  return function auditLogMiddleware(req, res, next) {
    const originalJson = res.json.bind(res);

    res.json = function (body) {
      // Restore immediately — must not delay response
      res.json = originalJson;
      const result = originalJson(body);

      // Only log successful responses
      if (res.statusCode < 200 || res.statusCode >= 300) return result;

      try {
        const resolve = (val) =>
          typeof val === "function" ? val(req, body) : val;

        const action = resolve(config.action);
        if (!action) return result; // dynamic resolver returned null — skip

        auditLogger({
          req,
          action,
          targetId:   resolve(config.targetId)   ?? null,
          targetType: resolve(config.targetType) ?? null,
          targetMeta: resolve(config.targetMeta) ?? {},
          note:       resolve(config.note)       ?? null,
        });
      } catch { /* never propagate */ }

      return result;
    };

    next();
  };
}

export default auditLog;