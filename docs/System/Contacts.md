---
sidebar_position: 7
---

# Contacts

Peers contacts let two people exchange their public identities and verify that
they connected to the intended person. Connecting does not share an account
secret or sign either person in on another device.

## Connect in person with a QR code

1. Open **Contacts** and choose **Connect to user**.
2. Keep Peers open while the connection QR code is visible.
3. Ask the other person to scan the QR code with their normal phone camera.
4. They open the Peers link and select **Connect**.
5. Compare the short confirmation value shown on both devices. Continue only
   when the values match.
6. Choose **Trust and view contact** to mark the person as trusted, or **View
   without trusting** to save the contact without granting trust.

The QR code and link expire after ten minutes. Create a new invite if the
countdown finishes or either person stops waiting.

## Share a connection link

Use **Share link** to send the same short-lived invite through a messaging or
email app. If sharing is unavailable, use **Copy link** and paste it yourself.
Both people need Peers open and connected to the internet or another Peers
device while the exchange completes.

The connection code is kept after `#` in the link, so it is not sent to the web
server as part of the page request. Treat an active link as a temporary bearer
invite and share it only with the intended person.

## Enter a code manually

Select **Enter a code instead** and enter the displayed
`XXXX-YYYY-ZZZZ` code. This uses the same exchange and confirmation step as the
QR/link flow.

## Troubleshooting

- **Invite not found or expired:** Ask the other person to create a new invite
  and keep their Connect screen open.
- **Device is not connected:** Connect to the internet or another Peers device,
  then select **Check again**.
- **Other device stopped waiting:** Ask the other person to reopen **Connect to
  user** and share the new invite.
- **Connection canceled:** Reopen **Connect to user** and retry with a new
  invite. Peers clears the previous attempt so it cannot resume unexpectedly.
- **Confirmation values do not match:** Do not grant trust. Cancel and restart
  the connection with a new invite.
- **Invalid link or code:** Open a fresh link or carefully re-enter the complete
  12-character code.

Connecting exchanges public contact and device identity through the existing
Peers network. Trust remains an explicit local choice. This flow is not account
sign-in, account recovery, or a way to transfer a secret key.

To sign in a new installation to your own account, use
[Add another device](./Device-Pairing.md) instead.
