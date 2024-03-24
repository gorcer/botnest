import { ExchangeError } from "../errors/ExchangeError";

function extractCodeAndMsg(str) {
  // Паттерны для поиска значений code и msg
  const codePattern = /"code":"?(-?\d+)"?/;
  const msgPattern = /"msg":"(.*?)"/;

  const codeMatch = str.match(codePattern);
  const msgMatch = str.match(msgPattern);

  const result = {} as { code: string; msg: string };

  if (codeMatch) {
    result.code = codeMatch[1]; // Возвращает только значение code
  }

  if (msgMatch) {
    result.msg = msgMatch[1]; // Возвращает только сообщение msg
  }

  return result; // Возвращает объект с найденными значениями
}

export function CatchApiError(
  target: any,
  propertyName: string,
  descriptor: PropertyDescriptor,
) {
  const method = descriptor.value;

  descriptor.value = async function (...args: any[]) {
    try {      
      return await method.apply(this, args);
    } catch (error) {
      
      // console.log('extractCodeAndMsg', args[0]?.account_id);
      const { code, msg } = extractCodeAndMsg(error.message);

      if (args[0] && args[0].account_id) {        
        
        await this.eventEmitter.emitAsync('api.error', {
          api: args[0],
          code,
          message: msg,
        });
      }

      throw new ExchangeError(error.message, code);
    }
  };
}
