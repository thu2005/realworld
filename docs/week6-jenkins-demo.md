# Week6 — demo Jenkins (Person E)

Phần này tiếp nối cấu hình Cypress/Allure của Person D. Person E bổ sung 3 test
kiểm tra lỗi tài khoản trong `cypress/e2e/account-validation.spec.js`; tổng cộng
5 test UI cùng với 2 test public UI có sẵn. `cy.intercept` chỉ theo dõi request,
không giả lập response. Các trường hợp thiếu mật khẩu bị API từ chối trước khi
lưu tài khoản, phù hợp demo nhiều lần trên container tạm.

Cypress cũng xuất JUnit XML riêng cho mỗi spec (`cypress-[hash].xml`) để mục
Tests của Jenkins hiển thị kết quả UI cùng với các kiểm tra lifecycle. Hash
tránh hai spec ghi đè kết quả của nhau.

## Chuẩn bị

1. Khởi động Docker và Jenkins theo `docs/jenkins-cypress-allure.md`.
2. Job dùng Pipeline from SCM với Jenkinsfile của nhánh chứa thay đổi Week6.
3. Chuẩn bị image GHCR có tag là full commit SHA đã được Actions push thành công.
   Không dùng SHA của PR nếu workflow PR bỏ qua bước push image.
4. Jenkins cần quyền chạy Docker, Cypress và Allure đã cài theo cấu hình Person D.
   Dùng credential `ghcr-credentials` nếu package private.

Nếu tải plugin qua Java hoặc `archives.jenkins.io` bị treo/SSL, dùng endpoint
chính thức đã kiểm chứng trong lượt Week6 (vẫn kiểm tra SHA-256):

```powershell
docker compose -f docker-compose.jenkins.yml build --build-arg JENKINS_PLUGIN_INSTALLER=curl --build-arg JENKINS_PLUGIN_DOWNLOAD_URL=https://updates.jenkins.io/download/plugins jenkins
docker compose -f docker-compose.jenkins.yml up -d --no-build jenkins
```

## Demo tại lớp (khoảng 5 phút)

| Bước | Thao tác | Kết quả cần trình bày |
|---|---|---|
| 1 | Mở Actions run đã push image; ghi nhận SHA | Phân biệt source commit và image tag |
| 2 | Build with Parameters: `RUN_MODE=image`, repo `ghcr.io/thu2005/realworld`, tag SHA, `PULL_IMAGE=true`, `SMOKE_PATH=/api/tags`, timeout `120` | Pull → run → API smoke → Cypress → Allure thành công |
| 3 | Mở Allure Report | 5 test passed, trong đó 3 test validation của Person E |
| 4 | Chạy lại với `IMAGE_TAG=latest` | Build FAILURE ở Validate image input; không chạy Cypress |
| 5 | Chạy lại với tag SHA đúng | SUCCESS trở lại; artifacts và cleanup được lưu |

Không đặt tag sai làm giá trị mặc định của job. Với private package bật
`GHCR_PRIVATE=true`; token được lấy từ Jenkins Credentials.

Ca lỗi thêm nếu còn thời gian: giữ tag SHA đúng, đặt
`SMOKE_PATH=/api/week6-deliberately-missing` và `SMOKE_TIMEOUT_SECONDS=30`.
Ứng dụng trả 404, stage Smoke test thất bại và vẫn lưu log/cleanup. Trả lại
`/api/tags` và `120` trước lượt demo thành công tiếp theo.

## Gọi cùng job qua API client

Client có sẵn `jenkins/trigger_jenkins.py` nhận biến môi trường, đợi build xong,
ghi `test-reports/jenkins-result.json` và trả exit code 1 nếu downstream thất bại.
Person E bổ sung tùy chọn `PULL_IMAGE`, `GHCR_PRIVATE`, `SMOKE_PATH` và
`SMOKE_TIMEOUT_SECONDS`; mặc định production vẫn pull public image.

Ví dụ PowerShell sau khi đã đặt `JENKINS_USER` và `JENKINS_TOKEN` trong môi trường
local hoặc Secrets (không ghi token vào tài liệu, screenshot hay git):

```powershell
$env:JENKINS_URL = 'http://localhost:18080'
$env:JENKINS_JOB = 'ci-cd-demo-week6'
$env:IMAGE_REPO = 'ghcr.io/thu2005/realworld'
$env:IMAGE_TAG = '<full-40-character-published-SHA>'
$env:SUT_REPO_URL = 'https://github.com/thu2005/realworld.git'
$env:SUT_REF = $env:IMAGE_TAG
$env:PULL_IMAGE = 'true'
$env:GHCR_PRIVATE = 'false'
python jenkins/trigger_jenkins.py

# Demo thất bại có chủ đích; kết thúc với exit code 1 là đúng kỳ vọng.
$env:IMAGE_TAG = 'latest'
python jenkins/trigger_jenkins.py
```

Mỗi lần gọi ghi đè JSON kết quả; lưu bản riêng nếu cần so sánh các lượt.
Job local `ci-cd-demo-week6` dùng để kiểm chứng, các thành viên thay bằng tên job
của mình. GitHub-hosted runner không truy cập được Jenkins chỉ mở ở localhost;
kết quả gọi API local không chứng minh webhook/trigger tự động từ GitHub hoạt động.

## Ảnh cần chụp

- Trang build SUCCESS có tên job, số build và artifacts.
- Allure overview có 5 passed, mở suite account validation thấy 3 test mới.
- Build FAILURE với `IMAGE_TAG=latest` và console báo full SHA bắt buộc.
- Console cuối build thành công: lưu báo cáo và cleanup.

Các ảnh phải lấy từ build Week6 thực tế; không dùng ảnh Week5 hoặc build của
Person D để nhận là kết quả của Person E.
