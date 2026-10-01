# Demacia Rising Offline

Chơi tại **https://hieunguyen1053.github.io/demacia-rising/**.

Bản Unity WebGL chạy trên website tĩnh, với hồ sơ và tiến trình lưu trong trình duyệt. Không cần Python, máy chủ API, League Client hoặc tài khoản Riot. Đây là bản offline không chính thức phục vụ mục đích học tập, không liên kết với Riot Games; tài nguyên thuộc chủ sở hữu tương ứng.

## Chơi và sử dụng offline

Lần đầu mở trang cần Internet để tự tải khoảng **340 MB**. Trang hiển thị số tệp và dung lượng, kiểm tra kích thước/SHA-256 rồi lưu vào Cache Storage. Game khởi động khi hiện **Sẵn sàng offline**. Sau đó có thể mở lại cùng địa chỉ trong cùng hồ sơ trình duyệt khi mất mạng.

Nếu tải bị gián đoạn, mở lại trang hoặc bấm **Thử tải lại**; những tệp đã tải và đúng hash được dùng lại. Nếu thiếu dung lượng, giải phóng bộ nhớ và thử lại. Xóa dữ liệu website sẽ xóa bộ game offline lẫn bản lưu. Trình duyệt có thể từ chối persistent storage hoặc tự thu hồi dữ liệu; xuất bản lưu JSON thường xuyên.

Bộ tài nguyên giữ nguyên toàn bộ **87 assetbundle**, **742 OGG** và WebGL build đã ghim. Mỗi lần khởi động, trang kiểm tra lại các tệp trong cache trước khi báo sẵn sàng. Cập nhật chuẩn bị cache riêng và chỉ chuyển phiên bản sau khi bộ mới đầy đủ; bản lưu không bị reset.

- **Kết thúc lượt** để lưu tiến trình. Những thao tác trong lượt chưa kết thúc không được giữ sau khi tải lại.
- **Nhận Silver Shields** cấp 350 Shields cục bộ và khởi động lại từ lượt đã lưu gần nhất.
- **Xuất/Nhập bản lưu** bằng tệp JSON hoặc dán JSON; hỗ trợ chuyển tiến trình từ bản localhost cũ.
- **Tiến trình mới** thay hồ sơ sau khi xác nhận. Sao lưu trước khi dùng.

Bản lưu nằm trong IndexedDB `demacia-rising-offline`, store `profiles`, khóa `current`. Các origin khác nhau (Pages, localhost, cổng khác, trình duyệt khác) có dữ liệu riêng. Chỉ mở một tab game trên cùng origin để tránh ghi đè.

Giao diện trang bằng tiếng Việt; game và lời thoại dùng tiếng Anh. Cửa hàng, đồng bộ Riot và phần thưởng tài khoản Riot không hoạt động. Nhiệm vụ và ví được xử lý cục bộ.

## Phát triển

Cần **Node.js 22 trở lên**. Chỉ dùng dependency khi build/preview; website production không tải thư viện từ bên ngoài.

```bash
npm ci
npm test
npm run verify-assets
npm run build
npm run preview
```

Mở `http://127.0.0.1:8080/`. Preview là máy chủ tĩnh; không có API, proxy, downloader hoặc endpoint ghi log. Build xuất `dist/`, có thể phục vụ bằng bất kỳ máy chủ tĩnh HTTPS hoặc localhost nào. Không mở bằng `file://` vì service worker cần secure context.

- `web/`: mã nguồn trang, cầu nối client cục bộ, hồ sơ và bộ cache offline.
- `assets/`: tài nguyên gốc và manifest kiểm tra; được theo dõi trong Git.
- `scripts/`: build minify và xác minh catalog/hash bằng Node, không dùng mạng.
- `tests/`: kiểm thử hợp đồng bản lưu, transport, catalog và cache.

Build minify JavaScript/CSS/HTML do dự án viết; giữ nguyên mã Unity sinh và các tệp nhị phân. Không sửa hoặc đổi tên bundle để tránh sai đường dẫn trong catalog. Manifest production được sinh từ tệp sau build. Service worker và cache dùng scope riêng theo thư mục project, hỗ trợ cả đường dẫn gốc và `/demacia-rising/`.

Chẩn đoán chỉ ghi lỗi/cảnh báo trong trình duyệt. Client-config được trả cục bộ; telemetry bị bỏ qua. Không gửi hồ sơ, log hay yêu cầu tải game đến Riot/CDN. Không có bộ tải CDN trong repository hoặc workflow.

## GitHub Pages

Repository: **https://github.com/hieunguyen1053/demacia-rising**.

Pages dùng nguồn **GitHub Actions**. Push lên `main` hoặc chạy workflow thủ công sẽ cài dependency từ lockfile, chạy kiểm thử, xác minh toàn bộ tài nguyên, build và triển khai duy nhất `dist/`. Workflow không tải game từ CDN.

## Phạm vi xác minh

Tài nguyên nguồn được kiểm tra đủ 87 bundle theo dependency closure của catalog và đủ 742 OGG; tất cả được đối chiếu kích thước/SHA-256. Bộ kiểm thử bảo vệ trạng thái lượt, ví, xuất/nhập bản lưu, phản hồi API cục bộ, hash tải và byte range âm thanh.

Các nhánh gameplay xuyên suốt toàn bộ Act 1/Act 2 chưa được chơi hết. Việc đủ tài nguyên đã liệt kê không chứng minh mọi đường dẫn âm thanh tạo động ngoài catalog đều đã được khám phá.

Bản Pages đã được kiểm tra tải đủ 840 mục cache, khởi động Unity và phục vụ âm thanh byte-range `206`. Bản production local đã mở lại và kết thúc lượt khi máy chủ HTTP tắt hẳn, giữ lượt 2 với 90 Shields; thử làm hỏng cache đã chặn khởi động và phục hồi bằng tải lại. Cập nhật cache đã giữ nguyên bản lưu. 16 kiểm thử tự động bao gồm tải gián đoạn/tiếp tục, cache hỏng, hết quota và bảo vệ cache cũ khi cập nhật chưa hoàn tất; nếu tải cập nhật thất bại, trang tiếp tục dùng bản cache cũ đã đầy đủ. Minify giảm JS/CSS/HTML của trang khoảng 23%; tổng production khoảng 339,65 MB vì tài nguyên Unity và âm thanh được giữ nguyên.
