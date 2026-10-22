# Payment Receipt Format

This document defines the data and format used to generate a payment
receipt for a completed payment, as required by issue MISC-010.

## On-chain data source

The contract exposes `get_payment_receipt(caller, order_id)` in
`contracts/payment-processing-contract/src/lib.rs`, which returns a
`PaymentReceipt` (defined in
`contracts/payment-processing-contract/src/types.rs`):

| Field             | Type           | Description                                              |
|-------------------|----------------|------------------------------------------------------------|
| `order_id`        | `Bytes`        | Unique order identifier.                                    |
| `amount`          | `i128`         | Payment amount, in the token's smallest unit (stroops).      |
| `token`           | `Address`      | Contract address of the token used for payment.              |
| `merchant_address`| `Address`      | The merchant's Stellar address.                              |
| `merchant_name`   | `String`       | The merchant's registered display name.                      |
| `payer`           | `Address`      | The payer's Stellar address.                                 |
| `status`          | `PaymentStatus`| Completed / Refunded / PartiallyRefunded, at time of query.   |
| `paid_at`         | `u64`          | Unix timestamp (seconds) the payment was recorded.            |

Access control matches `get_payment_by_id`: only the payer, the
merchant, or an admin may request a receipt for a given `order_id`
(`PaymentError::Unauthorized` otherwise).

## Why the transaction hash is not returned by the contract

A Soroban contract cannot observe the hash of the Stellar transaction
that invoked it, so `tx_hash` is intentionally **not** a field on
`PaymentReceipt`. The off-chain service that renders the PDF (see
below) must resolve it independently, e.g. by looking up the
`payment_processed` event (see the event emitted in
`process_payment_with_signature`) via Horizon/an indexer and reading
the enclosing transaction's hash from there.

## Off-chain PDF rendering (service responsibility)

Turning the fields above into a downloadable PDF, and exposing a
download endpoint to the payer/merchant, is an off-chain concern and
out of scope for the contract itself. The recommended shape for that
service:

1. Call `get_payment_receipt` (or read the already-indexed payment
   record) to obtain the fields above.
2. Resolve the transaction hash for the `payment_processed` event with
   the matching `order_id` via the indexer/Horizon.
3. Render a PDF containing: order ID, amount (formatted with the
   token's decimals), token code, merchant name, ISO-8601 timestamp
   derived from `paid_at`, and the transaction hash.
4. Serve it from a download endpoint authorized the same way as
   `get_payment_receipt` (payer, merchant, or admin only).

This keeps the receipt's on-chain-verifiable fields authoritative
(sourced directly from contract storage) while leaving formatting and
file generation to the off-chain layer where PDF libraries are
available.
