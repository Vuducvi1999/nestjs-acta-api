import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const Ack = createParamDecorator(
  (_data: unknown, context: ExecutionContext) => {
    const handlerArgs = context.getArgs();
    const ackCallback = handlerArgs[2];

    return typeof ackCallback === 'function' ? ackCallback : () => {};
  },
);
