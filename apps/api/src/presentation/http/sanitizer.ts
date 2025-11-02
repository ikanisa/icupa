import type { RequestHandler } from 'express';
import xss from 'xss';

const sanitizeValue = (value: unknown): unknown => {
  if (typeof value === 'string') {
    return xss(value, { whiteList: {}, stripIgnoreTag: true, stripIgnoreTagBody: ['script'] });
  }
  if (Array.isArray(value)) {
    return value.map(sanitizeValue);
  }
  if (value && typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>).reduce<Record<string, unknown>>(
      (acc, [key, val]) => {
        acc[key] = sanitizeValue(val);
        return acc;
      },
      {}
    );
  }
  return value;
};

export const sanitizeRequest: RequestHandler = (req, _res, next) => {
  req.body = sanitizeValue(req.body);
  req.query = sanitizeValue(req.query) as Record<string, unknown>;
  req.params = sanitizeValue(req.params) as Record<string, string>;
  next();
};
