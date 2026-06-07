Test:

Test 1

Normal execution

Expected:

Pass
Test 2

Wrong URL

Change:

TARGET_URL=abc

Expected:

Graceful error

not crash.

Test 3

Empty Name

FORM_NAME=

Expected:

Validation warning
Test 4

Slow Network

Add artificial delay.

Expected:

Retries