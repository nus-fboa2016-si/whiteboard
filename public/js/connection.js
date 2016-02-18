var countText = null;

function updateCount(count) {
	if (!countText) {
		return;
	}
	countText.html(count + ' CONNECTED');
}

function initCount() {
	countText = $('<div class="count">' + 1 + ' CONNECTED</div>').appendTo('body');
}