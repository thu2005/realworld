# Jenkins setup for the RealWorld seminar

Tài liệu này dựng pipeline Jenkins tối thiểu cho RealWorld theo `CI_INTEGRATION_CONTRACT.md`. Pipeline hiện chạy trực tiếp từ source; chưa phụ thuộc Docker image, Cypress hoặc Allure của thành viên khác.

## 1. Thành phần đã chuẩn bị

- `jenkins/Dockerfile`: Jenkins LTS trên Java 21, kèm Node.js 14.21.3, npm 6.14.18 và công cụ build native.
- `jenkins/plugins.txt`: danh sách plugin tối thiểu cho Pipeline, GitHub, credentials và JUnit.
- `docker-compose.jenkins.yml`: chạy Jenkins ở port 8080 và lưu dữ liệu bằng named volume.
- `Jenkinsfile`: checkout RealWorld, cài dependency, lint, test, build và publish report.

Jenkins chạy build ngay trên controller chỉ để giữ demo seminar đơn giản. Đây không phải cấu hình khuyến nghị cho hệ thống production.

## 2. Yêu cầu

- Docker Desktop đang chạy ở Linux containers mode.
- Máy có tối thiểu khoảng 4 GB RAM trống cho Docker/Jenkins và đủ dung lượng để build Next.js.
- Branch chứa các file Jenkins đã được commit và push lên GitHub.
- Port 8080 và 50000 chưa bị ứng dụng khác sử dụng. Có thể đổi host port bằng `JENKINS_HTTP_PORT` và `JENKINS_AGENT_PORT`.

## 3. Khởi động Jenkins

Từ thư mục gốc repository:

```bash
docker compose -f docker-compose.jenkins.yml up -d --build
docker compose -f docker-compose.jenkins.yml ps
```

Lấy mật khẩu khởi tạo:

```bash
docker compose -f docker-compose.jenkins.yml exec jenkins \
  cat /var/jenkins_home/secrets/initialAdminPassword
```

Mở `http://localhost:8080`, nhập mật khẩu và tạo tài khoản admin. Các plugin cần thiết đã được cài từ `jenkins/plugins.txt`; không cần cài Blue Ocean hoặc Allure ở bước MVP.

## 4. Tạo job `ci-cd-demo`

1. Chọn **New Item** → nhập `ci-cd-demo` → chọn **Pipeline**.
2. Ở phần **Pipeline**, chọn **Pipeline script from SCM**.
3. Chọn SCM **Git**.
4. Nhập URL fork của nhóm, ví dụ `https://github.com/thu2005/realworld.git`.
5. Chọn branch chứa `Jenkinsfile`, ví dụ `*/jenkins`.
6. Đặt **Script Path** là `Jenkinsfile`, sau đó Save.
7. Chọn **Build with Parameters**:
   - `SUT_REPO_URL`: `https://github.com/thu2005/realworld.git`
   - `SUT_REF`: `jenkins` trong lúc phát triển pipeline; đổi thành `next` sau khi branch này được merge.

Lần chạy đầu sẽ lâu hơn vì Jenkins phải tải npm dependencies. Kết quả test nằm tại **Test Result**; XML và log liên quan được lưu trong **Build Artifacts** nếu đã được sinh.

## 5. Kiểm tra pipeline

Pipeline thành công khi lần lượt qua các stage:

```text
Checkout → Verify runtime → Install → Lint → Test → Build
```

Kiểm tra các điểm sau trong console output:

- Node là `v14.21.3`, npm là `6.14.18`.
- Submodule `realworld` đã được checkout.
- Lint không có lỗi.
- Mocha sinh `test-reports/junit/mocha.xml` và Jenkins đọc được test result.
- `npm run build-dev` hoàn tất.

Không thêm `|| true` hoặc tắt stage để biến build lỗi thành pass. Nếu fail, sửa nguyên nhân rồi chạy lại.

## 6. GitHub webhook

Webhook chỉ cấu hình khi Jenkins có URL mà GitHub truy cập được; `localhost` không dùng được từ GitHub.

1. Vào repository GitHub → **Settings** → **Webhooks** → **Add webhook**.
2. Payload URL: `https://<jenkins-public-url>/github-webhook/`.
3. Content type: `application/json`.
4. Chọn sự kiện push.
5. Push một commit nhỏ lên branch của job và kiểm tra Jenkins tự chạy.

Nếu Jenkins mới chỉ chạy local, dùng **Build with Parameters** để hoàn thành demo pipeline trước; không mở port Internet chỉ để có webhook.

Nếu container báo `healthy` nhưng `http://localhost:8080` không truy cập được, chạy:

```bash
docker compose -f docker-compose.jenkins.yml port jenkins 8080
docker compose -f docker-compose.jenkins.yml up -d --force-recreate
```

Nếu lệnh đầu không trả về host port, restart Docker Desktop rồi tạo lại container. Đây là lỗi port forwarding của Docker Desktop, không sửa bằng cách đổi port bên trong Jenkins.

## 7. Dừng và khởi động lại

```bash
docker compose -f docker-compose.jenkins.yml stop
docker compose -f docker-compose.jenkins.yml start
```

Named volume giữ lại job và lịch sử build. Lệnh sau xóa cả container lẫn dữ liệu Jenkins, chỉ dùng khi chắc chắn muốn làm lại từ đầu:

```bash
docker compose -f docker-compose.jenkins.yml down --volumes
```

## 8. Điểm nối cho giai đoạn sau

Khi GitHub Actions đã build image, mở rộng `Jenkinsfile` bằng `IMAGE_REPO` và `IMAGE_TAG` theo contract. Khi Cypress hoặc Allure có output thật, publish đúng các đường dẫn trong `CI_INTEGRATION_CONTRACT.md`. Không thay pipeline source hiện tại trước khi nhánh image chạy ổn định.

## 9. Giới hạn đã biết

SUT dùng nhiều dependency cũ và `npm install` hiện báo nhiều lỗ hổng, gồm cả mức high/critical. Pipeline Jenkins MVP chưa dùng `npm audit` làm quality gate vì việc nâng đồng loạt dependency có thể làm hỏng ứng dụng mẫu. Không chạy `npm audit fix --force` tự động; phần security scan cần được xử lý thành task riêng và thống nhất ngưỡng với nhóm GitHub Actions.
