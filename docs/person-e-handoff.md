# Bàn giao Jenkins — Person E

**Người thực hiện:** Trần Trọng Trí — MSSV 20120221.  
**Phạm vi:** chạy image, smoke/Cypress, JUnit/Allure, demo pass/fail và cleanup.
Kế thừa hạ tầng Jenkins/Cypress/Allure do Person D thiết lập.

## 1. Thiết lập một lần

1. Chạy Docker Desktop ở Linux containers mode, clone repository và vào thư mục gốc.
2. Dựng Jenkins theo [jenkins-setup.md](jenkins-setup.md). Nếu tải plugin chậm/SSL:

   ```powershell
   docker compose -f docker-compose.jenkins.yml build --build-arg JENKINS_PLUGIN_INSTALLER=curl --build-arg JENKINS_PLUGIN_DOWNLOAD_URL=https://updates.jenkins.io/download/plugins jenkins
   docker compose -f docker-compose.jenkins.yml up -d --no-build jenkins
   ```

3. Tạo job **Pipeline script from SCM**, Git URL `https://github.com/thu2005/realworld.git`,
   branch `*/next`, script path `Jenkinsfile`. Tên job tích hợp của nhóm là `ci-cd-demo`.
   Chạy lần đầu để khởi tạo tham số. Job demo riêng có thể đặt tên khác.
4. Nếu package private, tạo Jenkins username/password credential ID `ghcr-credentials`,
   password là token đọc package, rồi bật `GHCR_PRIVATE=true`.
5. Không tạo thêm push webhook cho job đã nhận API trigger từ Actions.

Mở Jenkins tại `http://localhost:18080`. Named volume lưu job và lịch sử build;
dùng `docker compose -f docker-compose.jenkins.yml stop` để dừng, giữ dữ liệu.

## 2. Chạy từ giao diện Jenkins

**Build with Parameters:**

| Tham số | Giá trị |
|---|---|
| `RUN_MODE` | `image` |
| `IMAGE_REPO` | `ghcr.io/thu2005/realworld` |
| `IMAGE_TAG` | Full 40-character SHA của image thực sự đã publish |
| `PULL_IMAGE` | `true` |
| `GHCR_PRIVATE` | `false` với public package |
| `SMOKE_PATH` | `/api/tags` |
| `SMOKE_TIMEOUT_SECONDS` | `120` |

Luồng: checkout SCM → validate → Docker → pull → start → API smoke → Cypress →
JUnit/Allure → archive. Cleanup chạy cả khi thất bại. SUT chỉ ở trong Docker
network riêng của build, không cần mở thêm cổng ứng dụng ra host.

Kết quả image mode bình thường: **5 UI tests** trong Allure; **11 JUnit checks**
gồm 5 UI và 6 bước lifecycle. Không nhầm 11 checks thành 11 UI tests.

## 3. Mini-demo bằng script (khoảng 5 phút)

Cài Python 3.8+ trên máy gọi API. Sau khi đặt `JENKINS_USER`/`JENKINS_TOKEN`
trong môi trường local (không commit hoặc chụp ảnh giá trị token):

```powershell
$env:JENKINS_URL = 'http://localhost:18080'
$env:JENKINS_JOB = 'ci-cd-demo'
$env:IMAGE_REPO = 'ghcr.io/thu2005/realworld'
$env:IMAGE_TAG = '<full-SHA-da-publish>'
$env:SUT_REPO_URL = 'https://github.com/thu2005/realworld.git'
$env:SUT_REF = $env:IMAGE_TAG
$env:PULL_IMAGE = 'true'
$env:GHCR_PRIVATE = 'false'
python jenkins/demo.py pass
python jenkins/demo.py invalid-tag
python jenkins/demo.py bad-smoke
python jenkins/demo.py pass
```

`invalid-tag` dùng `latest` để kiểm tra validation; `bad-smoke` gọi endpoint
không tồn tại và đợi HTTP 404 trong 30 giây. Script chỉ chấp nhận FAILURE đúng
stage/nguyên nhân dự kiến và yêu cầu cleanup hoàn tất. Lỗi pull/network khác
sẽ làm demo thất bại, không bị nhận nhầm là ca lỗi có chủ đích thành công.

**Phân biệt exit code:** API client `trigger_jenkins.py` luôn trả 1 khi build
Jenkins FAILURE. Script trình diễn `demo.py` trả 0 khi chứng minh được đúng
kết quả mong đợi, kể cả ca Jenkins FAILURE có chủ đích. Không dùng demo wrapper
thay client production trong workflow CI.

Mỗi kịch bản lưu riêng `test-reports/demo/<scenario>/jenkins-result.json`.
Jenkins lưu JUnit XML, video Cypress, log và Allure; thư mục `.local` trên máy
người phát triển không cần thiết để tái hiện pipeline.

## 4. Minh chứng và bàn giao

- Build SUCCESS: chụp tên job/số build, artifacts và link Allure.
- Allure: 5 passed, suite account validation có 3 test.
- Build FAILURE: console thông báo tag không phải SHA hoặc smoke HTTP 404.
- Cleanup: xem `test-reports/logs/integration-summary.json`, `cleanup_complete=true`.
- Ghi riêng SCM revision của Jenkinsfile và SHA/digest image được kiểm tra.

`SUT_REF` dùng để checkout source mode; image mode truy vết ứng dụng bằng
`IMAGE_TAG` và image digest. Job lấy Jenkinsfile từ SCM có thể ở revision mới
hơn image, vì vậy cần ghi cả hai thay vì mặc định chúng bằng nhau.

Giới hạn: đây là demo seminar chạy trên Jenkins controller. Kiểm chứng local
không tự chứng minh kết nối GitHub-hosted Actions → Jenkins localhost. Nhóm
Actions tiếp tục chịu trách nhiệm publish image và cấu hình đường mạng/secrets.
