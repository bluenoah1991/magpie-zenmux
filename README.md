# ZenMux for Magpie

Use [ZenMux](https://zenmux.ai) Builder Plan or Pay As You Go in Magpie, with streaming, tool calling, and reasoning levels for supported models.

## Get started

1. On Magpie's Plugins page, choose **Builder Plan API key** or **PAYG API key** and enter the key for that plan.
2. Enable subscription account discovery in Magpie so your agents can use plugin models.
3. Select a ZenMux model on the Agents page and start a new agent session.

To view usage, choose the separate **Management API key (quota and balance only)** button under **ZenMux Management** and enter an `sk-mgmt-` key. This account reports Builder Plan quota and PAYG balance; it does not provide models. Management keys previously saved with a plan account continue to report usage on that account.

## Availability

Model access depends on your plan. Builder Plan and PAYG use separate keys; the plugin never switches billing plans automatically.

Image generation requires a compatible Gemini client. Magpie's dedicated image-generation interface does not currently support this plugin.
