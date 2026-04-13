import type { OrderResultContract } from "../../Contracts/Workflow/OrderResultContract.ts";

export interface OrdersRepositoryProtocol {
  fetch(): Promise<OrderResultContract>;
}
