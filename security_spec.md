# Security Specification & Red-Team Payloads

## 1. Data Invariants
1. **Strict Ownership Isolation**: Every document in `/users/{userId}/...` belongs solely to `request.auth.uid == userId`. No user may read, list, create, update, or delete another user's private account, workspace settings, bell schedules, lessons, lesson progress, or non-school days.
2. **PII Isolation**: User email addresses are stored exclusively in `/users/{userId}/private/account` with no `allow list` access and `allow get` restricted to `request.auth.uid == userId`.
3. **Admin RBAC & Email-Spoofing Guard**: Only verified administrators (`exists(/admins/$(uid))` or verified `kclark@mpsk12.org` with `email_verified == true`) can create/update/delete school-wide master Skyward schedules (`/schools/milford_grade_school/schedules`), master non-school days (`/schools/milford_grade_school/nonSchoolDays`), master curriculum (`/schools/milford_grade_school/curriculum`), governance lock settings (`/schools/milford_grade_school/config/governance`), or `/admins/{adminUid}` entries.
4. **Teacher Governance Locks**: When `lockTeacherSchedules == true`, non-admin teachers are blocked at the Firestore rules level from creating, updating, or deleting `/users/{userId}/schedules` and `/users/{userId}/nonSchoolDays`. When `lockCurriculumUploads == true`, non-admin teachers are blocked from creating/deleting `/users/{userId}/lessons` (while still permitted to save personal `completed` / `notes` in `lessonProgress` or existing lesson `completed`/`notes`).
5. **Immutable Ownership & Server Timestamps**: `ownerId` and `createdAt` cannot be modified after creation, and `createdAt`/`updatedAt` must equal `request.time`.
6. **Bounded Payloads & Strict Schemas**: Every string has an explicit `.size()` ceiling, `bullets` is capped at `<= 10` items with element type validation, every ID matches `^[a-zA-Z0-9_\\-]+$` (`<= 128` chars), and shadow/ghost fields are rejected via `hasAll` / `hasOnly` and `affectedKeys().hasOnly()`.

## 2. The "Dirty Dozen" Attack Payloads (Expected: PERMISSION_DENIED)
1. **Unauthenticated Read**: `GET /schools/milford_grade_school/schedules/1_math` with `auth = null`.
2. **Cross-User PII Snooping**: `GET /users/userA/private/account` authenticated as `userB`.
3. **Non-Admin Modifying School Governance Lock**: `UPDATE /schools/milford_grade_school/config/governance` as a regular teacher (`lockTeacherSchedules: false`).
4. **Non-Admin Uploading Master Skyward Schedule**: `CREATE /schools/milford_grade_school/schedules/1_math` as a regular teacher.
5. **Admin Email Spoof Attack (Unverified Email)**: `CREATE /schools/milford_grade_school/schedules/1_math` with `token.email == 'kclark@mpsk12.org'` and `token.email_verified == false`.
6. **Self-Promotion to Admin**: `CREATE /admins/userB` authenticated as `userB`.
7. **Teacher Bypassing Schedule Lock**: `CREATE /users/userB/schedules/1_custom` as `userB` while `governance.lockTeacherSchedules == true`.
8. **Teacher Bypassing Curriculum Upload Lock**: `CREATE /users/userB/lessons/l1` as `userB` while `governance.lockCurriculumUploads == true`.
9. **Identity Spoofing on Create**: `CREATE /users/userA/lessons/l1` as `userA` with `ownerId: "userB"`.
10. **Shadow / Ghost Field Injection**: `CREATE /users/userA/workspace/settings` with extra field `isAdmin: true`.
11. **Client Timestamp Forgery**: `CREATE /schools/milford_grade_school/nonSchoolDays/d1` as admin with `createdAt: "2020-01-01T00:00:00Z"`.
12. **Array & String Exhaustion Attack**: `CREATE /schools/milford_grade_school/curriculum/l1` as admin with `bullets` length 25 or `notes` length 10,000.
