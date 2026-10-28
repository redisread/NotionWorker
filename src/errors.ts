import { isNotionClientError } from '@notionhq/client';

export class RequestError extends Error {
  constructor(message: string, readonly status: 400 | 401 | 403 | 404 | 409 | 429 | 502 | 503 = 400) {
    super(message);
  }
}

export function publicError(error: unknown): RequestError {
  if (error instanceof RequestError) return error;
  if (error instanceof SyntaxError) return new RequestError('请求必须是有效 JSON');
  if (isNotionClientError(error)) {
    switch (error.code) {
      case 'unauthorized': return new RequestError('Notion 凭据无效', 401);
      case 'restricted_resource': return new RequestError('没有访问该 Notion 资源的权限', 403);
      case 'object_not_found': return new RequestError('Notion 资源不存在或未授权', 404);
      case 'validation_error': return new RequestError('Notion 请求参数与数据库字段不匹配', 400);
      case 'rate_limited': return new RequestError('Notion 请求过于频繁，请稍后重试', 429);
    }
  }
  return new RequestError('上游服务请求失败，请稍后重试', 502);
}
