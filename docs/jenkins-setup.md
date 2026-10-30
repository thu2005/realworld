# Jenkins setup for the RealWorld seminar

> Image-mode integration: see [Jenkins image lifecycle](jenkins-image-mode.md). Cypress and Allure are documented in [Jenkins Cypress and Allure setup](jenkins-cypress-allure.md). The source instructions below describe the original baseline; use SCM branch `next` (or the reviewed integration branch), source ref `next`, and `RUN_MODE=source`. The integration job is triggered by Actions API, not a second GitHub push webhook.

Tài liệu này hướng dẫn dựng Jenkins cho RealWorld theo `CI_INTEGRATION_CONTRACT.md`. Pipeline hỗ trợ source mode và image mode; image mode đã tích hợp Docker smoke test, Cypress và Allure. Hướng dẫn demo ngắn và bàn giao nằm trong [Person E handoff](person-e-handoff.md).

## 1. Thành phần đã chuẩn bị

- `jenkins/Dockerfile`: Jenkins LTS trên Java 21, kèm Node.js 14.21.3, npm 6.14.18 và công cụ build native.
- `jenkins/plugins.txt`: danh sách plugin tối thiểu cho Pipeline, GitHub, credentials và JUnit.
- `docker-compose.jenkins.yml`: chạy Jenkins ở host port 18080 và lưu dữ liệu bằng named volume.
- `Jenkinsfile`: checkout RealWorld, cài dependency, lint, test, build và publish report.

Jenkins chạy build ngay trên controller chỉ để giữ demo seminar đơn giản. Đây không phải cấu hình khuyến nghị cho hệ thống production.

## 2. Yêu cầu

- Docker Desktop đang chạy ở Linux containers mode.
- Máy có tối thiểu khoảng 4 GB RAM trống cho Docker/Jenkins và đủ dung lượng để build Next.js.
- Branch chứa các file Jenkins đã được commit và push lên GitHub.
- Host port 18080 chưa bị ứng dụng khác sử dụng. Có thể đổi bằng `JENKINS_HTTP_PORT`.

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

Mở `http://localhost:18080`, nhập mật khẩu và tạo tài khoản admin. Các plugin cần thiết, gồm Allure, được cài tự động từ `jenkins/plugins.txt`; không cần cài Blue Ocean.

## 4. Tạo job `ci-cd-demo`

1. Chọn **New Item** → nhập `ci-cd-demo` → chọn **Pipeline**.
2. Ở phần **Pipeline**, chọn **Pipeline script from SCM**.
3. Chọn SCM **Git**.
4. Nhập URL fork của nhóm, ví dụ `https://github.com/thu2005/realworld.git`.
5. Chọn branch `*/next` chứa Jenkinsfile đã tích hợp của nhóm.
6. Đặt **Script Path** là `Jenkinsfile`, sau đó Save.
7. Với job mới, tham số chỉ xuất hiện sau lượt chạy đầu. Chọn **Build Now** một lần để Jenkins đọc Jenkinsfile và khởi tạo tham số (mặc định chạy source mode), sau đó chọn **Build with Parameters**:
   - `RUN_MODE`: `source` để chạy lint/test/build, hoặc `image` để chạy smoke/Cypress/Allure.
   - `SUT_REPO_URL`: `https://github.com/thu2005/realworld.git`
   - `SUT_REF`: `next` (hoặc SHA cần checkout ở source mode).
   - Với image mode: `IMAGE_TAG` phải là full SHA đã được push lên GHCR; xem [hướng dẫn bàn giao](person-e-handoff.md).

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

## 6. Trigger từ GitHub Actions

Job tích hợp nhận `IMAGE_REPO`/`IMAGE_TAG` qua `jenkins/trigger_jenkins.py` sau bước publish image của Actions. Đặt `JENKINS_URL`, `JENKINS_USER`, `JENKINS_TOKEN` trong GitHub Secrets; tên job phía Actions phải trùng job Jenkins (hiện workflow dùng `ci-cd-demo`). API token được tạo tại Jenkins → tài khoản → Configure/Security → API Token.

Không bật thêm GitHub push webhook hoặc SCM polling cho cùng job tích hợp: push có thể xảy ra trước khi image được publish và gây chạy trùng với Actions API trigger. Webhook là phương án thay thế cho một job source độc lập, không phải bước bắt buộc của image mode.

Nếu Jenkins chỉ chạy local, GitHub-hosted runner không truy cập được `localhost`. Dùng **Build with Parameters** hoặc API client từ máy local để demo; muốn tự động xuyên suốt cần runner cùng mạng hoặc URL Jenkins mà runner truy cập được. Không đánh dấu bước kết nối này đã thành công chỉ vì stage Actions được skip khi thiếu secret.

Nếu container báo `healthy` nhưng `http://localhost:18080` không truy cập được, chạy:

```powershell
docker compose -f docker-compose.jenkins.yml up -d --force-recreate
Invoke-WebRequest -UseBasicParsing http://localhost:18080/login
```

Kết quả mong đợi là HTTP 200. Một số phiên bản Docker Desktop có thể để `docker compose port jenkins 8080` hiển thị `:0` dù URL vẫn truy cập được, vì vậy hãy kiểm tra bằng HTTP. Nếu HTTP không phản hồi, kiểm tra host port bằng `Get-NetTCPConnection -State Listen -LocalPort 18080`, rồi chọn port trống qua `JENKINS_HTTP_PORT` và tạo lại container.

## 7. Dừng và khởi động lại

```bash
docker compose -f docker-compose.jenkins.yml stop
docker compose -f docker-compose.jenkins.yml start
```

Named volume giữ lại job và lịch sử build. Lệnh sau xóa cả container lẫn dữ liệu Jenkins, chỉ dùng khi chắc chắn muốn làm lại từ đầu:

```bash
docker compose -f docker-compose.jenkins.yml down --volumes
```

## 8. Pipeline image và UI test

Pipeline image, Cypress và Allure đã được bổ sung. Cách chạy, đường dẫn artifact và cấu hình credential nằm trong [Jenkins Cypress and Allure setup](jenkins-cypress-allure.md). Pipeline source cũ vẫn được giữ bằng `RUN_MODE=source`.

## 9. Giới hạn đã biết

SUT dùng nhiều dependency cũ và `npm install` hiện báo nhiều lỗ hổng, gồm cả mức high/critical. Pipeline Jenkins MVP chưa dùng `npm audit` làm quality gate vì việc nâng đồng loạt dependency có thể làm hỏng ứng dụng mẫu. Không chạy `npm audit fix --force` tự động; phần security scan cần được xử lý thành task riêng và thống nhất ngưỡng với nhóm GitHub Actions.
