# CI/CD Integration Contract

Tài liệu này quy định đầu vào, đầu ra và quy ước bắt buộc khi các thành viên tích hợp GitHub Actions, Jenkins và test harness vào repository này.

## 1. System Under Test

- **MUST:** Chỉ sử dụng ứng dụng RealWorld trong repository này làm System Under Test (SUT).
- **MUST NOT:** Không đưa eShop hoặc một ứng dụng mẫu khác vào pipeline chính.
- **MUST:** Giữ nguyên nhánh `next` làm baseline cho đến khi nhóm thống nhất đổi nhánh.
- Tài liệu Week 3 nhắc đến eShop chỉ là lịch sử khảo sát, không phải lựa chọn triển khai.

## 2. Runtime và cài dependency

- **MUST:** Dùng Node.js `14.21.3` và npm `6.14.18` theo trường `engines` trong `package.json` cho pipeline hiện tại. Đây là bản cuối của Node 14, cần thiết để dependency lint hiện tại hỗ trợ `node:path`.
- **MUST:** Dùng `npm install` khi repository chưa có `package-lock.json`.
- **MUST NOT:** Không tự đổi sang `npm ci`. Chỉ được dùng `npm ci` sau khi nhóm bỏ `package-lock.json` khỏi `.gitignore` và commit lockfile hợp lệ.
- **MUST:** Checkout submodule trước khi build hoặc chạy API test:

  ```bash
  git submodule update --init --recursive
  ```

- Việc nâng cấp Node/npm hoặc dependency lớn phải được thực hiện trong một pull request riêng và cập nhật lại tài liệu này.

## 3. Pipeline tối thiểu

Pipeline chính phải giữ đúng thứ tự fail-fast sau:

```text
Checkout → Install → Lint → Test → Build → Publish reports
```

Các lệnh baseline:

| Stage | Command |
|---|---|
| Install | `npm install` |
| Lint | `npm run lint` |
| Unit/API test | `npm test` |
| Build | `npm run build-dev` |

- **MUST:** Stage publish report/artifact phải chạy cả khi test thất bại.
- **MUST:** Pipeline phải báo fail nếu lint, test hoặc build fail; không thêm `|| true` để che lỗi.
- Newman, Cypress, k6 và Allure được thêm thành stage riêng khi test tương ứng đã tồn tại và chạy được cục bộ.

## 4. Giao tiếp GitHub Actions → Jenkins

Các tên sau là contract chung, không tự đổi tên trong từng workflow:

| Name | Meaning |
|---|---|
| `SUT_REPO_URL` | URL repository RealWorld |
| `SUT_REF` | Branch, tag hoặc commit cần checkout |
| `IMAGE_REPO` | Tên GHCR image, không bao gồm tag |
| `IMAGE_TAG` | Full Git commit SHA dùng làm image tag |

- **MUST:** Docker image dùng dạng `ghcr.io/<owner>/<image>:<full-git-sha>`.
- **MUST NOT:** Không dùng riêng tag `latest` để bàn giao hoặc deploy vì không truy vết được commit.
- Jenkins phải vẫn chạy được từ source với `SUT_REPO_URL` và `SUT_REF` khi `IMAGE_REPO`/`IMAGE_TAG` chưa có.

## 5. Runtime container và smoke test

- **MUST:** Ứng dụng lắng nghe trong container tại port `3000`.
- **MUST:** Pipeline cho phép ánh xạ host port bằng biến cấu hình, không hard-code một host port dùng chung.
- **MUST:** Dùng `GET /api/tags` làm endpoint smoke/health check cơ bản.
- **MUST:** Container ứng dụng phải được dừng và dọn sau pipeline, kể cả khi test fail.

## 6. Test reports và artifacts

Các công cụ phải ghi kết quả vào đúng đường dẫn sau:

| Output | Required path |
|---|---|
| JUnit XML | `test-reports/junit/*.xml` |
| Allure raw results | `test-reports/allure-results/` |
| Cypress screenshots | `test-reports/cypress/screenshots/` |
| Cypress videos | `test-reports/cypress/videos/` |
| Runtime logs | `test-reports/logs/` |

- **MUST:** Jenkins publish JUnit và archive artifacts từ các đường dẫn trên bằng bước chạy cả khi pipeline fail.
- **MUST NOT:** Không đổi đường dẫn output mà không cập nhật đồng thời `Jenkinsfile` và tài liệu này.
- Generated reports không commit vào source repository; chỉ lưu trên Jenkins/GitHub Actions. Ảnh hoặc log cần cho báo cáo seminar đặt trong thư mục minh chứng của repo tài liệu.

## 7. Secrets và credentials

- **MUST:** Token, password và webhook secret phải lưu trong GitHub Secrets hoặc Jenkins Credentials.
- **MUST NOT:** Không ghi secret trực tiếp trong `Jenkinsfile`, workflow, Dockerfile, script, log hoặc tài liệu.
- Jenkins credential ID thống nhất cho GHCR là `ghcr-credentials`.
- Không in giá trị credential ra console, kể cả khi debug pipeline.

## 8. Trách nhiệm khi tích hợp

Mỗi thay đổi CI/test phải đáp ứng đủ các điều kiện sau trước khi bàn giao:

- Chạy được bằng lệnh được ghi trong tài liệu, không phụ thuộc đường dẫn tuyệt đối trên máy cá nhân.
- Không yêu cầu file chưa được commit hoặc cấu hình bí mật không được mô tả.
- Ghi rõ command, environment variables, output path và điều kiện pass/fail.
- Không phá vỡ pipeline chạy từ source trong khi pipeline chạy từ Docker image chưa hoàn thiện.
- Nếu cần thay đổi contract, cập nhật file này trong cùng pull request và thông báo phần pipeline bị ảnh hưởng.

Mục tiêu tích hợp của seminar là chuỗi tối thiểu:

```text
GitHub/source → Jenkins → build/test → report
```

Webhook, GHCR, Cypress và Allure được nối thêm sau khi pipeline tối thiểu chạy ổn định.
