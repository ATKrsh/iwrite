---
name: credit-tracker
description: Automatically tracks and displays remaining Antigravity Credits in the workspace, deducting balance per AI transaction.
---

# Antigravity Credit Tracker Extension

This workspace skill tracks remaining Antigravity credits dynamically. Every time you make a tool call, run a command, or generate code, it records a transaction and decrements the balance.

## Current Balance
- **Credits Remaining:** 1,250
- **Total Used This Session:** 0
- **Last Transaction:** N/A

## Credit Rules
- Standard API call: 1 credit
- Large generation or test execution: 5 credits
- Build command execution: 10 credits

## Auto-Update Log
Transactions are saved to [credits_ledger.json](file:///e:/workspace/iwrite/credits_ledger.json). The Windows app and IDE can read this ledger to auto-refresh credits in real time when any transaction occurs.
