# Slice 1.2 identity and local sign-in

This note records the identity rules for adult sign-in. It does not authorize account linking or hosted providers.

## Stable adult

`auth.users.id` is the only stable adult id. A profile, when one exists, is one row for that same id. Slice 1.2 does not insert a profile at sign-in.

A provider is a credential on that adult. It is not a second application user. Apple, Google, phone, and email are identities owned by Supabase Auth.

## Fail closed

Automatic merge is forbidden when:

- display names match
- an email is unverified
- a phone and an email merely look related
- two adults have similar names

Phone, email, and later provider collisions stay fail closed until an explicit linking step in Slice 1.2. `enable_manual_linking` stays false. There is no merge-users action.

## What local sign-in does

One verified credential resolves to one Auth user.

- A new email, after the code or magic link is verified, creates one user when email signup is enabled.
- The same email verified again returns that same user id. It does not create a second user.
- A new Australian mobile, after the test code is verified, creates one user when SMS signup is enabled locally.
- The same mobile verified again returns that same user id.
- An email user and a phone user stay two users. This step does not link them.

The acceptance response is the same whether or not the account already exists. It does not say which.

## User-facing email

One email is the product flow. The local magic-link template puts a 6-digit code and a sign-in link in that same message. The user-facing path asks for the code. The link in that message is the same sign-in, completed by the callback exchange. There are not two email products.

## Local proof only

Local email is captured by Inbucket on `http://127.0.0.1:54324`. SMTP is not enabled. `enable_confirmations` stays false because the code or link is the proof.

Local phone uses `[auth.sms.test_otp]` for the fictional mobile `+61400000000`. The test code lives only in `supabase/config.toml`. Application code does not contain it.

CLI 2.118 keeps phone login off unless an SMS provider block is enabled. Local config sets `[auth.sms.twilio]` with the placeholder `local-test-otp` so phone login can start. That value is not a Twilio credential, and the mapped test number is accepted inside local Auth without sending an SMS. Do not copy that block to a hosted project.

Local callbacks, and no others, are executable:

- `http://127.0.0.1:3000/auth/callback`
- `stable://auth/callback`

Staging and production redirect lists are empty. Hosted Auth, Apple, Google, and a real SMS provider are unchanged.
