<?php
class Test {
	private $test;

	/**
	 * assigns private $test to "here"
	 *
	 * Try that
	 *
	 * @return string
	 */
	public function getTest() {
		return $this->test;
	}

	/**
	 * Already tests
	 *
	 * @return string
	 */
	public function getAlreadyTested() {
		return "I'm already tested!";
	}
}

$instance = new Test();
$instance->getTest();
$instance->getAlreadyTested();
