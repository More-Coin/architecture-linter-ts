import { FetchOrderUseCase } from "../../Application/UseCases/FetchOrderUseCase.ts";

export class OrderController {
  constructor(
    private readonly fetchOrderUseCase: FetchOrderUseCase,
  ) {}

  handle(): Promise<unknown> {
    return this.fetchOrderUseCase.execute();
  }
}
