import type { OrderResultContract } from "../Contracts/Workflow/OrderResultContract.ts";
import type { OrdersRepositoryProtocol } from "../Ports/Protocols/OrdersRepositoryProtocol.ts";

export class FetchOrderUseCase {
  constructor(
    private readonly ordersRepository: OrdersRepositoryProtocol,
  ) {}

  execute(): Promise<OrderResultContract> {
    return this.load();
  }

  private load(): Promise<OrderResultContract> {
    const repo = this.ordersRepository;
    return repo.fetch();
  }
}
