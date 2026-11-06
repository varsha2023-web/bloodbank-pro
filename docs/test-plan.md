# Manual test plan (status: NOT YET RUN - tick each after you try it)
| # | Area | Steps | Expected |
|---|------|-------|----------|
| 1 | Register | Register with valid data | Account created, redirected to login |
| 2 | Duplicate | Register same email again | "already registered" |
| 3 | Password rule | Register with "abc" | Rejected (8+, letter and number) |
| 4 | Login | Wrong password | "Wrong email or password" |
| 5 | Rate limit | 11 wrong logins | "Too many attempts" |
| 6 | Role check | Log in as user, open /admin.html | Sent to admin login; GET /api/admin/stats gives 403 |
| 7 | Logout | Click Log out, press Back, refresh dashboard | Redirected to login |
| 8 | Donor | Save donor form with age 15 | Rejected; valid age saves |
| 9 | Donation | Request a visit, cancel it | Status Cancelled |
| 10 | Search | Home page, filter O+ | Only Passed, unexpired stock; DEMO-PENDING and DEMO-EXPIRED never appear |
| 11 | Request | Submit with units 0 / 11 / bad mobile | Each rejected; valid one shows a request ID |
| 12 | Cancel | Cancel a Pending request | Cancelled; cannot cancel after Approved |
| 13 | Admin flow | Add batch, mark Passed, Under Review > Approved > Ready for Issue > Issue | Status Issued, stock reduced, user notified |
| 14 | Over-issue | Request more units than any batch holds, try to approve | Blocked with stock message |
| 15 | Bad transition | Via API try Pending -> Issued | 400 "Cannot change" |
| 16 | Reports | Download each CSV with a group filter | File downloads, filtered |
| 17 | Responsive | Resize to phone width | Menu collapses, tables scroll |
