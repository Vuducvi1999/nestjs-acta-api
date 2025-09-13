import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// --- Seed Data ---
const feelings = [
  { label: 'hạnh phúc', icon: '😊' },
  { label: 'được yêu', icon: '😘' },
  { label: 'đáng yêu', icon: '🥰' },
  { label: 'hào hứng', icon: '🤩' },
  { label: 'điên', icon: '🤪' },
  { label: 'sung sướng', icon: '😁' },
  { label: 'khờ khạo', icon: '🤪' },
  { label: 'tuyệt vời', icon: '😃' },
  { label: 'thú vị', icon: '😃' },
  { label: 'tích cực', icon: '😊' },
  { label: 'có phúc', icon: '😇' },
  { label: 'buồn', icon: '😔' },
  { label: 'biết ơn', icon: '😀' },
  { label: 'đang yêu', icon: '😘' },
  { label: 'cảm kích', icon: '😁' },
  { label: 'vui vẻ', icon: '🎉' },
  { label: 'tuyệt', icon: '😎' },
  { label: 'thư giãn', icon: '😌' },
  { label: 'thoải mái', icon: '😌' },
  { label: 'đầy hy vọng', icon: '🌷' },
  { label: 'mệt mỏi', icon: '😴' },
  { label: 'tự hào', icon: '😊' },
  { label: 'chu đáo', icon: '😏' },
  { label: 'hoài niệm', icon: '😌' },
  { label: 'ốm yếu', icon: '🥵' },
  { label: 'kiệt sức', icon: '😩' },
  { label: 'tự tin', icon: '😊' },
  { label: 'tươi mới', icon: '😊' },
  { label: 'hân hoan', icon: '😁' },
  { label: 'có động lực', icon: '😊' },
  { label: 'cô đơn', icon: '😔' },
  { label: 'OK', icon: '🆗' },
  { label: 'giận dữ', icon: '😡' },
  { label: 'hài lòng', icon: '😁' },
  { label: 'xúc động', icon: '😢' },
  { label: 'rất tuyệt', icon: '😃' },
  { label: 'quyết đoán', icon: '😏' },
  { label: 'bực mình', icon: '😡' },
  { label: 'đói', icon: '😱' },
  { label: 'đau đớn', icon: '😫' },
  { label: 'thất vọng', icon: '😞' },
  { label: 'lạnh', icon: '🥶' },
  { label: 'tuyệt cú mèo', icon: '😎' },
  { label: 'hối tiếc', icon: '😢' },
  { label: 'lo lắng', icon: '😟' },
  { label: 'tồi tệ', icon: '😞' },
  { label: 'đầy cảm hứng', icon: '🐝' },
  { label: 'phấn khích', icon: '😃' },
  { label: 'chuyên nghiệp', icon: '😊' },
  { label: 'thanh thản', icon: '😌' },
  { label: 'lạc quan', icon: '😊' },
  { label: 'dễ thương', icon: '😊' },
  { label: 'thật tuyệt', icon: '😃' },
  { label: 'thật giỏi', icon: '😎' },
  { label: 'vui nhộn', icon: '🤪' },
  { label: 'xuống tinh thần', icon: '😞' },
  { label: 'bình tĩnh', icon: '😌' },
  { label: 'ngạc nhiên', icon: '😲' },
  { label: 'bối rối', icon: '😕' },
  { label: 'xấu hổ', icon: '😳' },
  { label: 'tức giận', icon: '😠' },
  { label: 'ghen tị', icon: '😒' },
  { label: 'hối hận', icon: '😔' },
  { label: 'bình yên', icon: '🕊️' },
  { label: 'căng thẳng', icon: '😬' },
  { label: 'hài hước', icon: '😂' },
  { label: 'sợ hãi', icon: '😨' },
  { label: 'tò mò', icon: '🧐' },
  { label: 'tự do', icon: '🦅' },
  { label: 'được truyền cảm hứng', icon: '✨' },
  { label: 'được hỗ trợ', icon: '🤗' },
  { label: 'cô lập', icon: '🥶' },
  { label: 'được lắng nghe', icon: '👂' },
  { label: 'được tôn trọng', icon: '🙇' },
  { label: 'được tha thứ', icon: '🙏' },
  { label: 'được chấp nhận', icon: '🤝' },
  { label: 'được động viên', icon: '💪' },
  { label: 'bị bỏ rơi', icon: '🥲' },
  { label: 'được quan tâm', icon: '🤲' },
  { label: 'bị hiểu lầm', icon: '😶‍🌫️' },
  { label: 'được truyền cảm hứng', icon: '🌟' },
  { label: 'bị tổn thương', icon: '💔' },
  { label: 'được chữa lành', icon: '🩹' },
  { label: 'bất lực', icon: '😣' },
  { label: 'bối rối', icon: '😵' },
  { label: 'được tha thứ', icon: '🤍' },
  { label: 'được động viên', icon: '🙌' },
  { label: 'được bảo vệ', icon: '🛡️' },
  { label: 'được khích lệ', icon: '🚀' },
  { label: 'bị phản bội', icon: '🗡️' },
  { label: 'được an ủi', icon: '🤗' },
  { label: 'bị cô lập', icon: '🏝️' },
  { label: 'được đồng cảm', icon: '🤝' },
  { label: 'bị áp lực', icon: '🥵' },
  { label: 'được giải tỏa', icon: '💨' },
  { label: 'bị xúc phạm', icon: '😤' },
  { label: 'được tôn vinh', icon: '🏅' },
  { label: 'bị lãng quên', icon: '🫥' },
  { label: 'được nhớ đến', icon: '🧠' },
  { label: 'bị kiểm soát', icon: '🕹️' },
  { label: 'được tự do', icon: '🕊️' },
  { label: 'bị ghen tị', icon: '🫤' },
  { label: 'được ngưỡng mộ', icon: '👏' },
  { label: 'bị thất vọng', icon: '😞' },
  { label: 'được tin tưởng', icon: '🤞' },
  { label: 'bị nghi ngờ', icon: '🧐' },
  { label: 'được yêu thương', icon: '💖' },
  { label: 'bị tổn thương', icon: '💔' },
  { label: 'được chữa lành', icon: '🩹' },
  { label: 'bị xúc phạm', icon: '😤' },
  { label: 'được tôn vinh', icon: '🏅' },
  { label: 'kinh ngạc', icon: '🤯' },
  { label: 'hoang mang', icon: '😵' },
  { label: 'hối lỗi', icon: '🙇' },
  { label: 'đầy năng lượng', icon: '💪' },
  { label: 'bình yên', icon: '🕊️' },
  { label: 'hứng thú', icon: '🤔' },
  { label: 'tuyệt vọng', icon: '😩' },
  { label: 'lo âu', icon: '😰' },
  { label: 'đam mê', icon: '❤️‍🔥' },
];

// Activities grouped by category
const activities = [
  {
    category: 'Đang nghe...',
    icon: '🎧',
    items: [
      { label: 'nhạc', icon: '🎵' },
      { label: 'podcast', icon: '🎙️' },
      { label: 'sách nói', icon: '📚' },
      { label: 'radio', icon: '📻' },
      { label: 'tiếng chim hót', icon: '🐦' },
    ],
  },
  {
    category: 'Đang tìm...',
    icon: '🔍',
    items: [
      { label: 'chìa khóa', icon: '🔑' },
      { label: 'điện thoại', icon: '📱' },
      { label: 'ý tưởng', icon: '💡' },
      { label: 'cảm hứng', icon: '✨' },
      { label: 'con đường mới', icon: '🛤️' },
    ],
  },
  {
    category: 'Đang nghĩ về...',
    icon: '☁️',
    items: [
      { label: 'tương lai', icon: '🔮' },
      { label: 'quá khứ', icon: '🕰️' },
      { label: 'gia đình', icon: '👨‍👩‍👧‍👦' },
      { label: 'công việc', icon: '💼' },
      { label: 'giấc mơ', icon: '💭' },
    ],
  },
  {
    category: 'Đang đọc...',
    icon: '📖',
    items: [
      { label: 'sách', icon: '📚' },
      { label: 'báo', icon: '📰' },
      { label: 'tạp chí', icon: '🗞️' },
      { label: 'blog', icon: '💻' },
      { label: 'thơ', icon: '📜' },
    ],
  },
  {
    category: 'Đang chơi...',
    icon: '🎮',
    items: [
      { label: 'game điện tử', icon: '🎮' },
      { label: 'board game', icon: '🎲' },
      { label: 'cờ vua', icon: '♟️' },
      { label: 'trò chơi dân gian', icon: '🧩' },
      { label: 'đố vui', icon: '❓' },
    ],
  },
  {
    category: 'Đang xem...',
    icon: '👀',
    items: [
      { label: 'phim', icon: '🎬' },
      { label: 'truyền hình', icon: '📺' },
      { label: 'video', icon: '📹' },
      { label: 'thể thao', icon: '🏟️' },
      { label: 'trực tiếp', icon: '📡' },
    ],
  },
  {
    category: 'Đang ăn...',
    icon: '🍽️',
    items: [
      { label: 'bữa sáng', icon: '🥞' },
      { label: 'bữa trưa', icon: '🍛' },
      { label: 'bữa tối', icon: '🍲' },
      { label: 'đồ ăn nhẹ', icon: '🍪' },
      { label: 'trái cây', icon: '🍎' },
    ],
  },
  {
    category: 'Đang đi...',
    icon: '🚶',
    items: [
      { label: 'dạo bộ', icon: '🚶' },
      { label: 'chạy bộ', icon: '🏃' },
      { label: 'đạp xe', icon: '🚴' },
      { label: 'du lịch', icon: '✈️' },
      { label: 'leo núi', icon: '🧗' },
    ],
  },
  {
    category: 'Đang làm việc...',
    icon: '💼',
    items: [
      { label: 'ở văn phòng', icon: '🏢' },
      { label: 'tại nhà', icon: '🏠' },
      { label: 'dự án mới', icon: '📝' },
      { label: 'họp', icon: '📅' },
      { label: 'nghiên cứu', icon: '🔬' },
    ],
  },
  {
    category: 'Đang học...',
    icon: '📚',
    items: [
      { label: 'bài tập', icon: '📝' },
      { label: 'ôn thi', icon: '📖' },
      { label: 'ngôn ngữ mới', icon: '🈳' },
      { label: 'kỹ năng mềm', icon: '🧠' },
      { label: 'lập trình', icon: '💻' },
    ],
  },
  {
    category: 'Đang thư giãn...',
    icon: '🛀',
    items: [
      { label: 'nghe nhạc', icon: '🎵' },
      { label: 'xem phim', icon: '🎬' },
      { label: 'đọc sách', icon: '📚' },
      { label: 'ngủ', icon: '😴' },
      { label: 'thiền', icon: '🧘' },
    ],
  },
  {
    category: 'Đang giúp đỡ...',
    icon: '🤝',
    items: [
      { label: 'bạn bè', icon: '🧑‍🤝‍🧑' },
      { label: 'gia đình', icon: '👨‍👩‍👧‍👦' },
      { label: 'cộng đồng', icon: '🌏' },
      { label: 'tình nguyện', icon: '🤲' },
      { label: 'đồng nghiệp', icon: '👥' },
      { label: 'người lớn', icon: '👨' },
      { label: 'người già', icon: '👵' },
      { label: 'người trẻ', icon: '👦' },
      { label: 'người mới', icon: '👶' },
      { label: 'người khác', icon: '👤' },
    ],
  },
  {
    category: 'Đang nấu ăn...',
    icon: '👩‍🍳',
    items: [
      { label: 'làm bánh', icon: '🧁' },
      { label: 'nấu ăn gia đình', icon: '🍲' },
      { label: 'nướng BBQ', icon: '🍖' },
      { label: 'pha cà phê', icon: '☕' },
      { label: 'làm salad', icon: '🥗' },
    ],
  },
  {
    category: 'Đang tập thể dục...',
    icon: '🏋️',
    items: [
      { label: 'tập gym', icon: '🏋️' },
      { label: 'yoga', icon: '🧘‍♂️' },
      { label: 'bơi lội', icon: '🏊' },
      { label: 'cầu lông', icon: '🏸' },
      { label: 'bóng đá', icon: '⚽' },
    ],
  },
  {
    category: 'Đang sáng tạo...',
    icon: '🎨',
    items: [
      { label: 'vẽ tranh', icon: '🖌️' },
      { label: 'chụp ảnh', icon: '📷' },
      { label: 'làm nhạc', icon: '🎼' },
      { label: 'viết lách', icon: '✍️' },
      { label: 'làm thủ công', icon: '🧶' },
    ],
  },
  {
    category: 'Đang chăm sóc bản thân...',
    icon: '💆',
    items: [
      { label: 'spa', icon: '💆' },
      { label: 'chăm sóc da', icon: '🧴' },
      { label: 'ngủ trưa', icon: '🛌' },
      { label: 'đi dạo công viên', icon: '🌳' },
      { label: 'tắm nắng', icon: '🌞' },
    ],
  },
  {
    category: 'Đang chơi nhạc cụ...',
    icon: '🎸',
    items: [
      { label: 'guitar', icon: '🎸' },
      { label: 'piano', icon: '🎹' },
      { label: 'trống', icon: '🥁' },
      { label: 'violin', icon: '🎻' },
      { label: 'sáo', icon: '🎶' },
    ],
  },
  {
    category: 'Đang chăm sóc thú cưng...',
    icon: '🐾',
    items: [
      { label: 'dắt chó đi dạo', icon: '🐕' },
      { label: 'cho mèo ăn', icon: '🐈' },
      { label: 'tắm cho thú cưng', icon: '🛁' },
      { label: 'chơi với thú cưng', icon: '🐾' },
      { label: 'huấn luyện thú cưng', icon: '🎾' },
    ],
  },
  {
    category: 'Đang du lịch...',
    icon: '🌍',
    items: [
      { label: 'đi biển', icon: '🏖️' },
      { label: 'leo núi', icon: '🏔️' },
      { label: 'tham quan thành phố', icon: '🏙️' },
      { label: 'cắm trại', icon: '🏕️' },
      { label: 'khám phá ẩm thực', icon: '🍜' },
    ],
  },
  {
    category: 'Đang sưu tầm...',
    icon: '🧩',
    items: [
      { label: 'tem', icon: '📮' },
      { label: 'mô hình', icon: '🚗' },
      { label: 'đồng hồ', icon: '⌚' },
      { label: 'truyện tranh', icon: '📚' },
      { label: 'đồ cổ', icon: '🏺' },
    ],
  },
  {
    category: 'Chúc mừng',
    icon: '🎉',
    items: [
      { label: 'tình bạn', icon: '🤝' },
      { label: 'sinh nhật', icon: '🎂' },
      { label: 'ngày đặc biệt của bạn', icon: '🎉' },
      { label: 'Giáng sinh', icon: '🎄' },
      { label: 'Giao thừa', icon: '🎉' },
      { label: 'ngày đặc biệt này', icon: '🎉' },
      { label: 'sinh nhật của anh trai tôi', icon: '🎉' },
      { label: 'kết hôn', icon: '💍' },
      { label: 'tốt nghiệp', icon: '🎓' },
      { label: 'có em bé', icon: '👶' },
      { label: 'thăng chức', icon: '🏆' },
      { label: 'mua nhà mới', icon: '🏠' },
      { label: 'mua xe mới', icon: '🚗' },
      { label: 'ngày kỷ niệm', icon: '💖' },
      { label: 'mua sắm thành công', icon: '🛍️' },
      { label: 'được nhận học bổng', icon: '🎓' },
      { label: 'được thăng chức', icon: '🏅' },
      { label: 'được giải thưởng', icon: '🏆' },
      { label: 'kỷ niệm tình bạn', icon: '🤗' },
      { label: 'kỷ niệm tình yêu', icon: '💑' },
      { label: 'kỷ niệm gia đình', icon: '👨‍👩‍👧‍👦' },
      { label: 'ngày của mẹ', icon: '👩' },
      { label: 'ngày của cha', icon: '👨' },
      { label: 'ngày nhà giáo', icon: '👩‍🏫' },
      { label: 'ngày quốc tế phụ nữ', icon: '👩‍🎤' },
      { label: 'ngày quốc tế thiếu nhi', icon: '🧒' },
      { label: 'ngày lễ tình nhân', icon: '💘' },
      { label: 'ngày độc thân', icon: '🧑' },
      { label: 'ngày hội việc làm', icon: '💼' },
    ],
  },
];

async function seedFeelings() {
  console.log('🌱 Seeding PostFeeling...');
  for (const feeling of feelings) {
    await prisma.postFeeling.upsert({
      where: { label: feeling.label },
      update: { icon: feeling.icon },
      create: { label: feeling.label, icon: feeling.icon },
    });
    console.log(`  - Seeded feeling: ${feeling.label} ${feeling.icon}`);
  }
}

async function clearActivities() {
  console.log('🧹 Clearing PostActivity and PostActivityCategory...');
  // Delete PostActivity first due to FK constraint
  await prisma.postActivity.deleteMany({});
  await prisma.postActivityCategory.deleteMany({});
}

async function seedActivities() {
  console.log('🌱 Seeding PostActivityCategory and PostActivity...');
  for (const group of activities) {
    // Upsert category with icon
    const category = await prisma.postActivityCategory.upsert({
      where: { name: group.category },
      update: { icon: group.icon },
      create: { name: group.category, icon: group.icon },
    });
    for (const activity of group.items) {
      await prisma.postActivity.upsert({
        where: {
          label_categoryId: { label: activity.label, categoryId: category.id },
        },
        update: { icon: activity.icon },
        create: {
          label: activity.label,
          icon: activity.icon,
          categoryId: category.id,
        },
      });
      console.log(
        `  - Seeded activity: [${group.category}] ${activity.label} ${activity.icon}`,
      );
    }
  }
}

async function main() {
  try {
    await seedFeelings();
    await clearActivities();
    await seedActivities();
    console.log('✅ Seeding completed successfully!');
  } catch (error) {
    console.error('❌ Error during seeding:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
