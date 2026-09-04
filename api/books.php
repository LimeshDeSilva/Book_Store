<?php
/**
 * Books Catalog & Details API Endpoint
 */

require_once __DIR__ . '/../config/db.php';
startSecureSession();

$pdo = getDBConnection();

$action = $_GET['action'] ?? 'list';

// ======================== GET GENRES LIST ========================
if ($action === 'genres') {
    $stmt = $pdo->query("SELECT genreid, genreName FROM Genre ORDER BY genreName ASC");
    $genres = $stmt->fetchAll();
    sendJsonResponse(['success' => true, 'genres' => $genres]);
}

// ======================== GET SINGLE BOOK DETAILS ========================
if ($action === 'detail' || isset($_GET['id'])) {
    $bookId = (int)($_GET['id'] ?? 0);
    if ($bookId <= 0) {
        sendJsonResponse(['success' => false, 'message' => 'Invalid book ID.'], 400);
    }

    $stmt = $pdo->prepare("
        SELECT b.bookid, b.title, b.ISBN, b.price, b.stockQuantity, b.coverImageUrl,
               GROUP_CONCAT(DISTINCT a.name ORDER BY a.name SEPARATOR ', ') AS authors,
               GROUP_CONCAT(DISTINCT g.genreName ORDER BY g.genreName SEPARATOR ', ') AS genres,
               COALESCE(AVG(r.rate), 0) AS avgRating,
               COUNT(DISTINCT r.reviewld) AS reviewCount
        FROM Book b
        LEFT JOIN Book_Author ba ON b.bookid = ba.bookid
        LEFT JOIN Author a ON ba.authorid = a.authorid
        LEFT JOIN Book_Genre bg ON b.bookid = bg.bookid
        LEFT JOIN Genre g ON bg.genreid = g.genreid
        LEFT JOIN Review r ON b.bookid = r.bookid
        WHERE b.bookid = ?
        GROUP BY b.bookid
    ");
    $stmt->execute([$bookId]);
    $book = $stmt->fetch();

    if (!$book) {
        sendJsonResponse(['success' => false, 'message' => 'Book not found.'], 404);
    }

    // Fetch Reviews
    $stmtReviews = $pdo->prepare("
        SELECT r.reviewld, r.rate, r.review AS description, u.firstName, u.lastName
        FROM Review r
        JOIN Users u ON r.userid = u.userid
        WHERE r.bookid = ?
        ORDER BY r.reviewld DESC
    ");
    $stmtReviews->execute([$bookId]);
    $reviews = $stmtReviews->fetchAll();

    $book['avgRating'] = round((float)$book['avgRating'], 1);
    $book['price'] = (float)$book['price'];
    $book['stockQuantity'] = (int)$book['stockQuantity'];
    $book['reviews'] = $reviews;

    sendJsonResponse(['success' => true, 'book' => $book]);
}

// ======================== LIST BOOKS WITH SEARCH & FILTERS ========================
$search = trim($_GET['search'] ?? '');
$genreId = (int)($_GET['genre'] ?? 0);
$sort = $_GET['sort'] ?? 'featured';

$sql = "
    SELECT b.bookid, b.title, b.ISBN, b.price, b.stockQuantity, b.coverImageUrl,
           GROUP_CONCAT(DISTINCT a.name ORDER BY a.name SEPARATOR ', ') AS authors,
           GROUP_CONCAT(DISTINCT g.genreName ORDER BY g.genreName SEPARATOR ', ') AS genres,
           COALESCE(AVG(r.rate), 0) AS avgRating,
           COUNT(DISTINCT r.reviewld) AS reviewCount
    FROM Book b
    LEFT JOIN Book_Author ba ON b.bookid = ba.bookid
    LEFT JOIN Author a ON ba.authorid = a.authorid
    LEFT JOIN Book_Genre bg ON b.bookid = bg.bookid
    LEFT JOIN Genre g ON bg.genreid = g.genreid
    LEFT JOIN Review r ON b.bookid = r.bookid
";

$where = [];
$params = [];

if (!empty($search)) {
    $where[] = "(b.title LIKE ? OR b.ISBN LIKE ? OR a.name LIKE ?)";
    $like = '%' . $search . '%';
    $params[] = $like;
    $params[] = $like;
    $params[] = $like;
}

if ($genreId > 0) {
    $where[] = "b.bookid IN (SELECT bookid FROM Book_Genre WHERE genreid = ?)";
    $params[] = $genreId;
}

if (!empty($where)) {
    $sql .= " WHERE " . implode(" AND ", $where);
}

$sql .= " GROUP BY b.bookid";

switch ($sort) {
    case 'price_asc':
        $sql .= " ORDER BY b.price ASC";
        break;
    case 'price_desc':
        $sql .= " ORDER BY b.price DESC";
        break;
    case 'rating':
        $sql .= " ORDER BY avgRating DESC, reviewCount DESC";
        break;
    case 'title':
        $sql .= " ORDER BY b.title ASC";
        break;
    case 'featured':
    default:
        $sql .= " ORDER BY b.bookid ASC";
        break;
}

$stmt = $pdo->prepare($sql);
$stmt->execute($params);
$books = $stmt->fetchAll();

foreach ($books as &$book) {
    $book['price'] = (float)$book['price'];
    $book['stockQuantity'] = (int)$book['stockQuantity'];
    $book['avgRating'] = round((float)$book['avgRating'], 1);
    $book['reviewCount'] = (int)$book['reviewCount'];
}

sendJsonResponse([
    'success' => true,
    'count'   => count($books),
    'books'   => $books
]);
